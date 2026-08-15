document.addEventListener("DOMContentLoaded", () => {
  const headerContainer = document.getElementById("header");
  if (headerContainer) {
    fetch("/components/header.html")
      .then(res => res.text())
      .then(data => headerContainer.innerHTML = data);
  }

  const footerContainer = document.getElementById("footer");
  if (footerContainer) {
    fetch("/components/footer.html")
      .then(res => res.text())
      .then(data => footerContainer.innerHTML = data);
  }
});