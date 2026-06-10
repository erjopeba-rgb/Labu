// Validadores
const Validators = {
    email(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    phone(phone) {
        return /^\+?[\d\s-()]+$/.test(phone);
    },
    
    required(value) {
        return value && value.trim().length > 0;
    }
};
