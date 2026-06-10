// Formateadores
const Formatters = {
    currency(amount) {
        return '$' + amount.toFixed(2);
    },
    
    distance(meters) {
        return meters >= 1000 ? (meters/1000).toFixed(1) + ' km' : meters + ' m';
    },
    
    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'hace unos segundos';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `hace ${minutes} minutos`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `hace ${hours} horas`;
        const days = Math.floor(hours / 24);
        return `hace ${days} días`;
    }
};
