// Router SPA
const Router = {
    routes: {},
    
    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    },
    
    handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        console.log('Navegando a:', hash);
    }
};
