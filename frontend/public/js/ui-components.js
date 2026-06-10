// Componentes UI reutilizables
const UI = {
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    },
    
    showLoading() {
        document.body.classList.add('loading');
    },
    
    hideLoading() {
        document.body.classList.remove('loading');
    }
};
