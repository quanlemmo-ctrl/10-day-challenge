const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyViONPtOBAjwslOUKFZsYzAeT4Gyu3HecOvz_VFwnZvNkmzCywM-2JzoqdZmFFNhhxdQ/exec'; // Thay thế bằng URL của bạn

document.addEventListener('DOMContentLoaded', () => {
  const heroForm = document.getElementById('hero-form');
  const freeForm = document.getElementById('free-form');
  const freeError = document.getElementById('free-error');
  const freeSuccess = document.getElementById('free-success');

  const btnFree = document.getElementById('btn-free');
  const btnPro = document.getElementById('btn-pro');
  const checkoutModal = document.getElementById('checkout-modal');
  const checkoutClose = document.getElementById('checkout-close');
  const checkoutForm = document.getElementById('checkout-form');
  const checkoutQr = document.getElementById('checkout-qr');

  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleHeroSubmit = (e) => {
    e.preventDefault();
    const emailInput = heroForm.querySelector('input[type="email"]');
    const email = emailInput.value.trim();

    if (!email || !validateEmail(email)) {
      emailInput.style.borderColor = '#ff6b5e';
      emailInput.focus();
      return;
    }
    
    emailInput.style.borderColor = '';
    document.getElementById('form').scrollIntoView({ behavior: 'smooth' });
    
    // Mở sẵn form miễn phí
    if (freeForm) {
      freeForm.classList.add('active');
      const freeEmailInput = document.getElementById('free-email');
      if (freeEmailInput) {
        freeEmailInput.value = email;
        document.getElementById('free-name').focus();
      }
    }
  };

  const handleFreeSubmit = (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('free-name');
    const emailInput = document.getElementById('free-email');
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    let isValid = true;
    if (freeError) freeError.hidden = true;

    [nameInput, emailInput].forEach(input => {
      if(input) input.style.borderColor = '';
    });

    if (!name) {
      nameInput.style.borderColor = '#ff6b5e';
      isValid = false;
    }

    if (!email || !validateEmail(email)) {
      emailInput.style.borderColor = '#ff6b5e';
      isValid = false;
    }

    if (!isValid) {
      if (freeError) {
        freeError.textContent = 'Vui lòng điền thông tin hợp lệ.';
        freeError.hidden = false;
      }
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('stage', 'N/A');
    formData.append('challenge', 'N/A');
    formData.append('goal', 'N/A');
    formData.append('phone', 'N/A');

    const btn = freeForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Đang xử lý...';
    btn.disabled = true;

    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    })
    .then(res => res.json())
    .then(() => {
      freeForm.classList.remove('active');
      freeForm.style.display = 'none';
      if (freeSuccess) freeSuccess.style.display = 'block';
      
      freeForm.reset();
      btn.textContent = originalText;
      btn.disabled = false;
    })
    .catch(error => {
      console.error('Error!', error.message);
      if (freeError) {
        freeError.textContent = 'Có lỗi xảy ra, vui lòng thử lại sau.';
        freeError.hidden = false;
      }
      btn.textContent = originalText;
      btn.disabled = false;
    });
  };

  // PRICING ACTIONS
  if (btnFree) {
    btnFree.addEventListener('click', () => {
      freeForm.classList.toggle('active');
    });
  }

  if (btnPro) {
    btnPro.addEventListener('click', () => {
      checkoutModal.classList.add('active');
    });
  }

  if (checkoutClose) {
    checkoutClose.addEventListener('click', () => {
      checkoutModal.classList.remove('active');
    });
  }

  // Đóng modal khi click ra ngoài
  window.addEventListener('click', (e) => {
    if (e.target === checkoutModal) {
      checkoutModal.classList.remove('active');
    }
  });

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('checkout-name');
      const phoneInput = document.getElementById('checkout-phone');
      const emailInput = document.getElementById('checkout-email');
      
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      let phone = phoneInput.value.trim().replace(/\s+/g, '');
      
      // Basic phone validation for VN (10 digits, starts with 0)
      if (!/^0[0-9]{9}$/.test(phone)) {
        alert("Vui lòng nhập số điện thoại Việt Nam hợp lệ (gồm 10 chữ số, bắt đầu bằng 0).");
        phoneInput.focus();
        return;
      }
      
      const btn = checkoutForm.querySelector('button[type="submit"]');
      btn.textContent = 'Đang xử lý...';
      btn.disabled = true;

      try {
        // Tạo đơn hàng vào DB
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, email })
        });
        const data = await res.json();
        const orderId = data.order_id;

        // Sinh URL mã QR của Sepay (Giá test: 2000đ)
        const qrUrl = `https://qr.sepay.vn/img?acc=0868192288&bank=Vietinbank&amount=2000&des=SEVQR%20HD${phone}`;

        // Tạo thẻ ảnh
        const qrImg = document.createElement('img');
        qrImg.src = qrUrl;
        qrImg.alt = "Mã QR Thanh Toán";
        qrImg.style.width = "100%";
        qrImg.style.maxWidth = "250px";
        qrImg.style.borderRadius = "12px";
        qrImg.style.margin = "16px auto";
        qrImg.style.display = "block";

        checkoutForm.style.display = 'none';
        
        // Thêm ảnh QR vào div
        const qrTitle = checkoutQr.querySelector('h4');
        const qrDesc = checkoutQr.querySelector('p');
        checkoutQr.innerHTML = '';
        if(qrTitle) checkoutQr.appendChild(qrTitle);
        checkoutQr.appendChild(qrImg);
        if(qrDesc) checkoutQr.appendChild(qrDesc);

        checkoutQr.classList.add('active');

        // Polling trạng thái đơn hàng mỗi 3 giây
        const pollTimer = setInterval(async () => {
          const checkRes = await fetch(`/api/orders/check?id=${orderId}`);
          const checkData = await checkRes.json();
          if (checkData.status === 'success') {
            clearInterval(pollTimer);
            checkoutQr.innerHTML = `
              <div style="text-align:center; padding: 20px;">
                <h3 style="color:#00e676; margin-bottom:10px;">Thanh Toán Thành Công! 🎉</h3>
                <p>Cảm ơn bạn. Chúng tôi sẽ liên hệ Zalo qua số ${phone} trong giây lát.</p>
                <button class="btn btn--primary" onclick="window.location.reload()" style="margin-top:20px;">Đóng</button>
              </div>
            `;
          }
        }, 3000);

      } catch (err) {
        console.error(err);
        btn.textContent = 'Lỗi, thử lại sau';
        btn.disabled = false;
      }
    });
  }

  if (heroForm) heroForm.addEventListener('submit', handleHeroSubmit);
  if (freeForm) freeForm.addEventListener('submit', handleFreeSubmit);

  // ============ CHATBOT LOGIC ============
  const chatbotBtn = document.getElementById('chatbot-btn');
  const chatbotWindow = document.getElementById('chatbot-window');
  const chatbotClose = document.getElementById('chatbot-close');
  const chatbotBody = document.getElementById('chatbot-body');

  let chatInitialized = false;

  const faqs = [
    { q: "Tôi chưa từng làm video, cũng mù mờ công nghệ thì có theo được không?", a: "Hoàn toàn được. Mình thiết kế quy trình này kiểu \"cầm tay chỉ việc\", đi tuần tự từng bước một với các công cụ cụ thể. Phần lớn các công cụ AI giờ rất dễ dùng trên web, không cần cài đặt phức tạp hay kinh nghiệm dựng phim gì cả. Bạn cứ bình tĩnh làm theo là được." },
    { q: "Làm kênh faceless thì có thật sự không cần lộ mặt hay thu âm không?", a: "Chắc chắn rồi. Toàn bộ video sẽ dùng giọng đọc và hình ảnh do AI tạo ra. Bạn không cần phải ló mặt trước camera hay dùng giọng thật của mình. Rất hợp cho những ai hướng nội hoặc ngại lên hình." },
    { q: "Tôi có phải trả nhiều tiền mua các công cụ AI không?", a: "Hầu hết các công cụ trong danh sách mình gợi ý đều có bản miễn phí đủ để bạn bắt đầu và vọc vạch. Sau này kênh phát triển, thấy cần thiết thì bạn mới cân nhắc nâng cấp bản trả phí, chứ ban đầu thì không ép buộc." },
    { q: "Sao lại chia sẻ miễn phí, có lừa đảo hay ẩn ý gì không?", a: "Haha, không có thuyết âm mưu gì ở đây đâu. Mình muốn chia sẻ lại những gì mình đang mò mẫm làm thật để kết nối với những người cùng chí hướng, cùng nhau học hỏi. Đổi lại, mình chỉ xin vài thông tin cơ bản của bạn để hiểu rõ hơn về những khó khăn thực tế mà mọi người đang gặp phải thôi." },
    { q: "Nhận tài liệu bằng cách nào vậy?", a: "Dễ lắm, bạn chỉ cần điền thông tin vào form trên web, bấm gửi là bộ tài liệu PDF sẽ bay thẳng vào email của bạn ngay lập tức. Nếu đợi vài phút chưa thấy, nhớ ngó qua mục Spam hoặc Quảng cáo nhé." },
    { q: "Làm YouTube AI bây giờ có sợ bão hòa, cạnh tranh cao quá không?", a: "Ở đâu cũng có cạnh tranh, nhưng YouTube rộng lắm và vẫn còn đầy những ngách nhỏ sinh lời tốt. Trong tài liệu (Bước 1), mình có hướng dẫn cách chọn ngách \"ít cạnh tranh\". Thay vì đâm đầu vào chỗ đông người, mình đi vào ngách ngách một chút nhưng bền vững." },
    { q: "Tôi đi làm bận lắm, không có nhiều thời gian rảnh thì sao?", a: "Đó chính xác là lúc bạn cần AI làm đòn bẩy. AI sẽ giúp bạn tiết kiệm đến 80% thời gian lên kịch bản, tìm ảnh, làm giọng đọc. Chỉ cần bỏ ra 1-2 tiếng mỗi ngày, kiên trì theo quy trình là bạn hoàn toàn có thể duy trì được kênh." },
    { q: "Làm kênh kiểu này bao lâu thì có view hay kiếm được tiền?", a: "Cái này thì mình xin nói thật là... tùy vào độ kiên trì của bạn. Đừng mong đăng 1-2 video là có triệu view ngay. Đây là cuộc chơi dài hạn, cần làm đúng quy trình, tối ưu dần dần. Có người 1 tháng thấy kết quả, có người 3 tháng. Quan trọng là đừng bỏ cuộc giữa chừng." },
    { q: "Điền form xong có bị nhận email spam rác mỗi ngày không?", a: "Mình cam kết 100% không spam. Mình cũng ghét bị spam lắm. Email của bạn chỉ để nhận tài liệu và thỉnh thoảng mình sẽ gửi những chia sẻ thật về hành trình xây kênh của mình. Bạn thấy phiền thì cứ ấn Hủy đăng ký bất cứ lúc nào, mình hoàn toàn thoải mái." },
    { q: "Kịch bản AI viết thường nghe rất robot và rập khuôn, tài liệu có giải quyết được không?", a: "Câu hỏi rất hay! Trong Bước 4 và bộ prompt mẫu, mình có chia sẻ tư duy để điều khiển AI viết tự nhiên hơn, giữ chân người xem tốt hơn chứ không phải copy-paste một cách máy móc. AI viết hay đến đâu phụ thuộc rất nhiều vào người ra lệnh cho nó." }
  ];

  const appendBotMsg = (text) => {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = text;
    chatbotBody.appendChild(el);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
  };

  const appendUserMsg = (text) => {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = text;
    chatbotBody.appendChild(el);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
  };

  const showOptions = () => {
    // Xóa các option cũ
    const oldOpts = chatbotBody.querySelector('.chatbot-options');
    if (oldOpts) oldOpts.remove();

    const optsContainer = document.createElement('div');
    optsContainer.className = 'chatbot-options';
    
    // Lấy random 3 câu hỏi
    const shuffled = [...faqs].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    selected.forEach(faq => {
      const btn = document.createElement('button');
      btn.className = 'chatbot-option';
      btn.textContent = faq.q;
      btn.onclick = () => {
        optsContainer.remove();
        appendUserMsg(faq.q);
        setTimeout(() => {
          appendBotMsg(faq.a);
          setTimeout(() => {
            appendBotMsg("Tuyệt vời! Nếu bạn đã sẵn sàng bắt tay vào làm và không ngại thử nghiệm, thì bộ tài liệu 7 bước này sinh ra là dành cho bạn. Bạn chỉ cần điền thông tin vào form trên màn hình, chưa tới 1 phút là tài liệu đã nằm gọn trong email của bạn rồi. Bắt đầu ngay thôi nào!");
            showCTA();
          }, 1500);
        }, 600);
      };
      optsContainer.appendChild(btn);
    });

    const otherBtn = document.createElement('button');
    otherBtn.className = 'chatbot-option';
    otherBtn.textContent = "Tôi muốn hỏi câu khác";
    otherBtn.onclick = () => {
      optsContainer.remove();
      showOptions();
    };
    optsContainer.appendChild(otherBtn);

    chatbotBody.appendChild(optsContainer);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
  };

  const showCTA = () => {
    const optsContainer = document.createElement('div');
    optsContainer.className = 'chatbot-options';

    const ctaBtn = document.createElement('button');
    ctaBtn.className = 'chatbot-cta-btn';
    ctaBtn.textContent = "Nhận tài liệu miễn phí →";
    ctaBtn.onclick = () => {
      document.getElementById('form').scrollIntoView({ behavior: 'smooth' });
      chatbotWindow.classList.remove('active');
    };

    const fallbackBtn = document.createElement('div');
    fallbackBtn.className = 'chatbot-fallback';
    fallbackBtn.textContent = "Để tôi nghĩ thêm";
    fallbackBtn.onclick = () => {
      optsContainer.remove();
      appendUserMsg("Để tôi nghĩ thêm");
      setTimeout(() => {
        appendBotMsg("Mình hiểu, bắt đầu một thứ mới bao giờ cũng cần thời gian suy nghĩ. Không sao cả! Nhưng thay vì tự mò mẫm giữa hàng ngàn thông tin ngoài kia, bạn cứ tải bộ quy trình này về máy đi. Nó hoàn toàn miễn phí. Cất đó, lúc nào rảnh mở ra xem, biết đâu lại tìm thấy cảm hứng để bắt đầu thì sao? <br><br><a href='#form' onclick='document.getElementById(\"chatbot-window\").classList.remove(\"active\")' style='color:var(--brand-2); font-weight:bold; text-decoration:none;'>Nhấn vào đây để tải tài liệu nhé!</a>");
      }, 600);
    };

    optsContainer.appendChild(ctaBtn);
    optsContainer.appendChild(fallbackBtn);
    chatbotBody.appendChild(optsContainer);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
  };

  const initChat = () => {
    if (chatInitialized) return;
    chatInitialized = true;
    setTimeout(() => {
      appendBotMsg("Chào bạn! Rất vui được gặp bạn ở đây. Mình không có những khóa học làm giàu hay bí kíp đổi đời sau một đêm đâu nhé. Ở đây mình chỉ có một quy trình thực chiến 7 bước giúp bạn tự tay xây kênh YouTube Faceless bằng AI từ con số 0. Bạn đang vướng mắc ở bước nào, hay muốn tìm hiểu thêm về tài liệu này?");
      setTimeout(showOptions, 1500);
    }, 400);
  };

  const handleUserInput = () => {
    const input = document.getElementById('chatbot-input');
    const text = input.value.trim();
    if (!text) return;

    // Remove old options if any
    const oldOpts = chatbotBody.querySelector('.chatbot-options');
    if (oldOpts) oldOpts.remove();

    appendUserMsg(text);
    input.value = '';

    const lower = text.toLowerCase();
    setTimeout(() => {
      if (lower.includes('giá') || lower.includes('tiền') || lower.includes('phí')) {
        appendBotMsg("Tài liệu này hoàn toàn miễn phí (0đ). Mình muốn chia sẻ lại những gì mình đang mò mẫm làm thật để kết nối với những người cùng chí hướng. Đổi lại, mình chỉ xin vài thông tin cơ bản của bạn để hiểu rõ hơn về những khó khăn thực tế mà mọi người đang gặp phải thôi.");
        setTimeout(showCTA, 1500);
      } 
      else if (lower.includes('nghĩ thêm') || lower.includes('chưa mua') || lower.includes('từ từ')) {
        appendBotMsg("Mình hiểu, bắt đầu một thứ mới bao giờ cũng cần thời gian suy nghĩ. Không sao cả! Nhưng thay vì tự mò mẫm giữa hàng ngàn thông tin ngoài kia, bạn cứ tải bộ quy trình này về máy đi. Nó hoàn toàn miễn phí. Cất đó, lúc nào rảnh mở ra xem, biết đâu lại tìm thấy cảm hứng để bắt đầu thì sao? <br><br><a href='#form' onclick='document.getElementById(\"chatbot-window\").classList.remove(\"active\")' style='color:var(--brand-2); font-weight:bold; text-decoration:none;'>Nhấn vào đây để tải tài liệu nhé!</a>");
      }
      else if (lower.includes('phù hợp') || lower.includes('có hợp') || lower.includes('mù mờ') || lower.includes('người mới')) {
        appendBotMsg("Quy trình này được thiết kế dành riêng cho người mới tinh, đi từ con số 0. Bạn không cần lộ mặt, không cần kinh nghiệm quay dựng, cũng không cần kỹ năng công nghệ cao siêu vì các công cụ AI giờ rất dễ dùng. Cứ đi tuần tự từng bước là được.");
        setTimeout(showCTA, 1500);
      }
      else {
        // Fallback for unmatched questions
        let bestMatch = faqs.find(f => lower.split(' ').some(word => word.length > 3 && f.q.toLowerCase().includes(word)));
        
        if (bestMatch) {
          appendBotMsg(bestMatch.a);
          setTimeout(showCTA, 1500);
        } else {
          appendBotMsg("Câu này hơi khó hoặc nằm ngoài kịch bản của mình rồi. Bạn có muốn xem thêm các câu hỏi thường gặp hoặc nhận tài liệu miễn phí luôn không?");
          setTimeout(showOptions, 1500);
        }
      }
    }, 600);
  };

  const sendBtn = document.getElementById('chatbot-send');
  const chatInput = document.getElementById('chatbot-input');
  
  if (sendBtn) {
    sendBtn.addEventListener('click', handleUserInput);
  }
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleUserInput();
    });
  }

  if (chatbotBtn) {
    chatbotBtn.addEventListener('click', () => {
      chatbotWindow.classList.toggle('active');
      if (chatbotWindow.classList.contains('active')) {
        initChat();
      }
    });
  }

  if (chatbotClose) {
    chatbotClose.addEventListener('click', () => {
      chatbotWindow.classList.remove('active');
    });
  }
});
