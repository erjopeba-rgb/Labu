/**
 * UserCard — fábrica de tarjetas de profesional.
 * Extraído de: components/user-card.html
 *
 * Uso:
 *   grid.innerHTML = trabajadores.map(UserCard.render).join('');
 *
 * Callbacks esperados en la página: verPerfil(id), contactar(id)
 */
const UserCard = {
    render(t) {
        const nombre    = t.nombre || 'Profesional';
        const iniciales = nombre.substring(0, 2).toUpperCase();
        const rubro     = t.rubro_nombre || t.profesion || '';
        const rating    = t.calificacion_promedio ? Number(t.calificacion_promedio).toFixed(1) : 'Nuevo';
        const reviews   = t.total_calificaciones || 0;
        const distancia = t.distancia_km ? Number(t.distancia_km).toFixed(1) + ' km' : '-';
        const tarifa    = t.tarifa_hora ? '$' + Number(t.tarifa_hora).toLocaleString('es-AR') + '/h' : 'A convenir';
        const exp       = t.anos_experiencia ? t.anos_experiencia + ' a&#241;os' : '-';

        const habilidades = (t.habilidades || []).slice(0, 4)
            .map(h => '<span class="skill-tag">' + h + '</span>')
            .join('');

        return (
            '<div class="result-card">' +
                '<div class="result-header">' +
                    '<div class="result-avatar">' + iniciales + '</div>' +
                    '<div class="result-info">' +
                        '<div class="result-name">' + nombre + '</div>' +
                        '<div class="result-role">' + rubro + '</div>' +
                        '<div class="result-rating">' +
                            '<span class="stars">&#11088;</span>' +
                            '<span>' + rating + (reviews > 0 ? ' (' + reviews + ' rese&#241;as)' : '') + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                (habilidades ? '<div class="result-skills">' + habilidades + '</div>' : '') +
                '<div class="result-details">' +
                    '<div>' +
                        '<div class="detail-icon">&#128176;</div>' +
                        '<div class="detail-label">Tarifa</div>' +
                        '<div class="detail-value">' + tarifa + '</div>' +
                    '</div>' +
                    '<div>' +
                        '<div class="detail-icon">&#128205;</div>' +
                        '<div class="detail-label">Distancia</div>' +
                        '<div class="detail-value">' + distancia + '</div>' +
                    '</div>' +
                    '<div>' +
                        '<div class="detail-icon">&#128197;</div>' +
                        '<div class="detail-label">Experiencia</div>' +
                        '<div class="detail-value">' + exp + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="result-actions">' +
                    '<button class="btn-action btn-primary" onclick="verPerfil(' + t.id + ')">Ver Perfil</button>' +
                    '<button class="btn-action btn-secondary" onclick="contactar(' + t.id + ')">&#128172; Mensaje</button>' +
                '</div>' +
            '</div>'
        );
    }
};

window.UserCard = UserCard;
