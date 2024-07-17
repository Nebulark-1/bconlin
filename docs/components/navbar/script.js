document.addEventListener('DOMContentLoaded', function() {
  const toggler = document.getElementById('navbar-toggler');
  const collapse = document.getElementById('navbar-collapse');
  const navbar = document.querySelector('.navigation-wrap');
  let lastScrollTop = 0;

  toggler.addEventListener('click', function() {
    collapse.classList.toggle('active');
  });

  window.addEventListener('scroll', function() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop) {
      // Scrolling down
      navbar.style.top = '-60px'; // Adjust this value as per navbar height
    } else {
      // Scrolling up
      navbar.style.top = '0';
    }
    lastScrollTop = scrollTop;
  });
});
