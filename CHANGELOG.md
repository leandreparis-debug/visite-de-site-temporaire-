# Changelog

Toutes les évolutions notables de l'outil. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- **Photos liées aux observations** : « Lier des photos » sur chaque zone des notes ; les photos apparaissent sous la zone dans le rapport et la planche photos indique la zone.
- **Photo de page de garde** : une photo du site (l'entrepôt) choisie dans l'onglet Rapport, affichée sous le titre.
- **4 photos par page** pour la planche photos (en plus de 6 et 2).
- **Duplication** : case « Garder les notes par zone » (cochée par défaut) ; les photos ne sont jamais reprises.

### Modifié

- **Page de garde** sans pied de page (le bandeau a été retiré ; la date de génération reste, discrète, sous les informations).
- **Rapport Word** : toutes les pages en A4 portrait (les plans ne sont plus en paysage) ; nouvelle mise en page aux couleurs de Carrefour Property (prune du logo) : page de garde épurée, synthèse en cartes, tableaux à en-tête coloré et filets horizontaux, encadrés à liseré, en-tête avec logo, pied de page « Page X / Y ».
- **Plans annotés** : repères numérotés et légende nettement plus grands (≈ 4 % du grand côté du plan), lisibles une fois le plan imprimé en pleine largeur.
- **Logo officiel** Carrefour Property (remplace le logo provisoire) dans l'application et le rapport ; couleur principale de l'interface alignée sur le logo.

## [1.0.0] — 2026-09-28

Première version diffusée aux Property Managers de Carrefour Property.

### Fonctionnalités

- **Outil autonome** : un seul fichier HTML, ouvert d'un double-clic dans Chrome ou Edge, sans installation, sans serveur ni connexion réseau, sans IA. Données enregistrées dans le navigateur du poste, enregistrement automatique.
- **Visites et réunions** : création, recherche, filtres, tri, duplication pour le suivi d'un site (« reprendre le suivi »), suppression.
- **Informations générales** : site, date et heure, rédacteur, objet, participants présents ou absents (saisie rapide au clavier).
- **Notes** : sections par zone avec trames « visite technique » et « réunion », points d'attention et actions (priorité, responsable, échéance, retards signalés).
- **Photos** : import par lot (JPEG, PNG, WebP ; orientation EXIF, date de prise de vue), réduction automatique, légende, catégorie, réorganisation, visionneuse, rotation.
- **Plan interactif** : import de plans PDF (choix de la page) ou PNG / JPEG, zoom, repères photo numérotés placés par glisser-déposer, clic ou clavier, plan annoté téléchargeable en PNG.
- **Dommages-Ouvrage et assurances** : contrats avec état de validité, sinistres suivis en 10 étapes, délais légaux indicatifs (art. L242-1) avec alertes, montants.
- **Projets et coûts** : projets, coûts avec TVA arrondie ligne par ligne, regroupements et sous-totaux, totaux par stade (estimé, devisé, engagé, facturé), « Copier pour Excel » (repli CSV).
- **Rapport Word** : page de garde, synthèse, informations générales, observations, points d'attention, plans annotés en paysage, planche photos (2 ou 6 par page), DO et assurances, projets et coûts ; qualité Standard ou Allégée, estimation de taille, points à vérifier, progression, date du dernier rapport.
- **Aide intégrée** (bouton « Aide ») et guide utilisateur `GUIDE_UTILISATEUR.md` issus d'une même source.
- **Version affichée** dans le pied de page (« v1.0.0 — build du … »).

### Qualité

- Tests unitaires (Vitest) et de bout en bout en `file://` (Playwright) : aucune erreur console ni requête réseau, parcours complet, mise à jour entre deux versions, test de charge (60 photos de 12 Mpx, rapport en ≈ 11 s), audit d'accessibilité axe-core sans violation grave.
- Script `npm run release` : toutes les vérifications puis le dossier de diffusion.

### Limites connues

- Pas d'export ni d'import de visite : le rapport Word est l'archive durable.
- Données propres au poste et au navigateur.
- Photos HEIC (iPhone) non prises en charge.
- Chrome et Edge uniquement.
