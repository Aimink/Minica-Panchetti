Fichiers à remplacer

1) Site principal minica-panchetti.fr :
   - Remplacer / ajouter : VRun.html

2) Sous-domaine vrun.minica-panchetti.fr :
   - Remplacer : index.html
   - Remplacer : style.css
   - Remplacer : sketch.js
   - Garder aussi : p5.js, p5.sound.min.js, vrun.png, pinceau.png, favicon.png, CNAME

Correction apportée :
- Le sketch p5.js se dimensionne sur son conteneur/iframe.
- Le canvas est explicitement parenté à #vrun-p5.
- Les clics et touch events du bouton PLAY sont recalculés à partir des coordonnées du canvas.
- VRun.html intègre le sous-domaine en iframe pleine hauteur dans le hero.
