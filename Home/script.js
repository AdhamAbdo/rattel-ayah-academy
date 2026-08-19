// FAQ accordion
  document.querySelectorAll('.faq-q').forEach(q=>{
    q.addEventListener('click', ()=>{
      const item = q.parentElement;
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i=>i.classList.remove('open'));
      if(!wasOpen) item.classList.add('open');
    });
  });

  // Scroll reveal
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));



// ===============================
// Teachers Swiper
// ===============================

if (typeof Swiper !== "undefined") {

    const swiperElement = document.querySelector(".teachersSwiper");

    if (swiperElement) {

        new Swiper(".teachersSwiper", {

            loop: true,

            speed: 700,

            spaceBetween: 24,

            grabCursor: true,

            pagination: {
                el: ".swiper-pagination",
                clickable: true
            },

            navigation: {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev"
            },

            breakpoints: {

                0: {
                    slidesPerView: 1
                },

                768: {
                    slidesPerView: 2
                },

                1200: {
                    slidesPerView: 3
                }

            }

        });

    }

}