// Funciones auxiliares
const Helpers = {
    formatDate(date) {
        return new Date(date).toLocaleDateString('es-AR');
    },
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    truncate(str, length) {
        return str.length > length ? str.substring(0, length) + '...' : str;
    }
};
