document.addEventListener("DOMContentLoaded", () => {

    const headerContainer = document.getElementById("header");

    if (headerContainer) {
        fetch("/components/header.html")
            .then(res => res.text())
            .then(data => {

                headerContainer.innerHTML = data;

                const productsWrapper =
                    headerContainer.querySelector("#products-wrapper");

                const productsMenu =
                    headerContainer.querySelector("#products-menu");

                if (productsWrapper && productsMenu) {

                    let closeTimer = null;
                    let wrapperHovered = false;
                    let menuHovered = false;

                    function isAtTop() {
                        return window.scrollY <= 0;
                    }

                    function openProducts() {
                        clearTimeout(closeTimer);

                        if (!isAtTop()) {
                            return;
                        }

                        productsMenu.classList.add("open");

                        document.body.style.overflow = "hidden";
                    }

                    function closeProducts() {
                        clearTimeout(closeTimer);

                        productsMenu.classList.remove("open");

                        document.body.style.overflow = "";
                    }

                    function tryCloseProducts() {
                        clearTimeout(closeTimer);

                        closeTimer = setTimeout(() => {

                            if (!wrapperHovered && !menuHovered) {
                                closeProducts();
                            }

                        }, 150);
                    }

                    productsWrapper.addEventListener("mouseenter", () => {
                        wrapperHovered = true;
                        openProducts();
                    });

                    productsWrapper.addEventListener("mouseleave", () => {
                        wrapperHovered = false;
                        tryCloseProducts();
                    });

                    productsMenu.addEventListener("mouseenter", () => {
                        menuHovered = true;
                        openProducts();
                    });

                    productsMenu.addEventListener("mouseleave", () => {
                        menuHovered = false;
                        tryCloseProducts();
                    });

                    window.addEventListener("scroll", () => {
                        if (!isAtTop()) {
                            wrapperHovered = false;
                            menuHovered = false;
                            closeProducts();
                        }
                    });
                }
            });
    }


    const footerContainer = document.getElementById("footer");

    if (footerContainer) {
        fetch("/components/footer.html")
            .then(res => res.text())
            .then(data => {
                footerContainer.innerHTML = data;
            });
    }

});