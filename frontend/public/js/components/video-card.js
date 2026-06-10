/**
 * VideoCard — fábrica de tarjetas de video.
 * Extraído de: components/video-card.html
 *
 * Variante catálogo (videos-educativos):
 *   grid.innerHTML = videos.map(v => VideoCard.renderCatalog(v, 'openVideoModal')).join('');
 *
 * Variante mis-videos:
 *   grid.innerHTML = videos.map((v, i) => VideoCard.renderMis(v, i)).join('');
 *   Callbacks esperados: verVideo(id), editarVideo(id), statsVideo(id), eliminarVideo(id)
 */
const VideoCard = {

    _GRADIENTS: [
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #f093fb, #f5576c)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, #fa709a, #fee140)',
        'linear-gradient(135deg, #30cfd0, #330867)',
    ],

    renderCatalog(v, onClick) {
        const iniciales  = (v.autor_nombre || '??').substring(0, 2).toUpperCase();
        const verificado = v.autor_verificado ? ' <span class="author-verified">&#10003;</span>' : '';
        const clickAttr  = onClick
            ? 'onclick="' + onClick + '(' + v.id + ',' + !!v.comprado + ')"'
            : '';

        let overlay = '';
        if (v.comprado) {
            overlay = '<div class="owned-badge">&#10003; Ya comprado</div>';
        } else if (v.precio) {
            overlay = '<div class="video-locked">' +
                '<div class="lock-icon">&#128274;</div>' +
                '<div class="unlock-price">$' + Number(v.precio).toLocaleString('es-AR') + '</div>' +
                '</div>';
        } else {
            overlay = '<div class="owned-badge">&#10003; Gratis</div>';
        }

        let badge = '';
        if (v.badge === 'nuevo')   badge = '<div class="video-badge badge-new">&#128338; Nuevo</div>';
        if (v.badge === 'popular') badge = '<div class="video-badge badge-popular">&#128293; Popular</div>';
        if (v.badge === 'premium') badge = '<div class="video-badge badge-premium">&#128081; Premium</div>';

        const vistas  = v.vistas ? (v.vistas >= 1000 ? (v.vistas / 1000).toFixed(1) + 'k' : v.vistas) : '0';
        const rating  = v.puntaje_promedio ? v.puntaje_promedio : '-';
        const resenas = v.total_resenas ? ' (' + v.total_resenas + ')' : '';

        return (
            '<div class="video-card" ' + clickAttr + '>' +
                '<div class="video-thumbnail">' +
                    '&#128249;' +
                    '<div class="video-duration">' + (v.duracion || '--:--') + '</div>' +
                    badge +
                    overlay +
                '</div>' +
                '<div class="video-info">' +
                    '<span class="video-category">' + (v.categoria || '') + '</span>' +
                    '<h3 class="video-title">' + v.titulo + '</h3>' +
                    '<div class="video-author">' +
                        '<div class="author-avatar">' + iniciales + '</div>' +
                        '<div><div class="author-name">' + (v.autor_nombre || '') + verificado + '</div></div>' +
                    '</div>' +
                    '<div class="video-stats">' +
                        '<div class="video-views">&#128065;&#65039; ' + vistas + ' vistas</div>' +
                        '<div class="video-rating"><span class="star">&#9733;</span> ' + rating + resenas + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    },

    _statusBadge(estado) {
        if (estado === 'publicado')   return '<span class="video-status status-published">&#9989; Publicado</span>';
        if (estado === 'en_revision') return '<span class="video-status status-review">&#128260; En Revisi&#243;n</span>';
        return                               '<span class="video-status status-draft">&#128221; Borrador</span>';
    },

    renderMis(v, index) {
        const gradient = this._GRADIENTS[index % this._GRADIENTS.length];
        const vistas   = (v.vistas || 0).toLocaleString('es-AR');
        const precio   = '$' + Number(v.precio || 0).toLocaleString('es-AR');
        const ventas   = v.total_ventas || 0;
        const ganado   = v.ganancia_total ? '$' + Number(v.ganancia_total).toLocaleString('es-AR') : null;
        const isDraft  = v.estado !== 'publicado' && v.estado !== 'en_revision';

        const earningsHtml = (!isDraft && ganado)
            ? '<div class="video-earnings">' +
                '<span>&#128200; ' + ventas + ' ventas</span>' +
                '<span style="font-weight:bold;color:var(--secondary);">' + ganado + ' ganados</span>' +
              '</div>'
            : '';

        const actionsHtml = isDraft
            ? '<div class="video-actions">' +
                '<button class="btn-action btn-action-primary" onclick="editarVideo(' + v.id + ')">&#9999;&#65039; Continuar Editando</button>' +
                '<button class="btn-action btn-action-secondary" onclick="eliminarVideo(' + v.id + ')">&#128465;&#65039; Eliminar</button>' +
              '</div>'
            : '<div class="video-actions">' +
                '<button class="btn-action btn-action-primary" onclick="verVideo(' + v.id + ')">&#128065;&#65039; Ver</button>' +
                '<button class="btn-action btn-action-secondary" onclick="editarVideo(' + v.id + ')">&#9999;&#65039; Editar</button>' +
                '<button class="btn-action btn-action-secondary" onclick="statsVideo(' + v.id + ')">&#128202; Stats</button>' +
              '</div>';

        return (
            '<div class="video-card"' + (isDraft ? ' style="opacity:0.7"' : '') + '>' +
                '<div class="video-thumbnail" style="background:' + gradient + '">' +
                    this._statusBadge(v.estado) +
                    '<span class="video-duration">' + (v.duracion || '--:--') + '</span>' +
                    '&#127909;' +
                '</div>' +
                '<div class="video-info">' +
                    '<div class="video-title">' + v.titulo + '</div>' +
                    '<div class="video-stats">' +
                        '<div class="video-stat">&#128065;&#65039; ' + vistas + ' vistas</div>' +
                        (v.puntaje_promedio ? '<div class="video-stat">&#11088; ' + v.puntaje_promedio + '</div>' : '') +
                    '</div>' +
                    '<div class="video-price">' + precio + '</div>' +
                    earningsHtml +
                    actionsHtml +
                '</div>' +
            '</div>'
        );
    }
};

window.VideoCard = VideoCard;
