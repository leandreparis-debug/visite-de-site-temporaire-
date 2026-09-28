# Guide utilisateur — Comptes rendus de visite

<!-- Fichier généré par `npm run guide` depuis src/features/help/guideContent.ts : ne pas modifier à la main. -->

Outil de comptes rendus de visites techniques et de réunions pour les Property Managers de Carrefour Property. Il fonctionne sans Internet et sans installation : tout reste sur votre poste.

## 1. Démarrer

- **Ouvrir l’outil** : double-cliquez sur le fichier `CR-Visites-Carrefour-Property-v1.0.0.html`. Il s’ouvre dans votre navigateur, sans connexion Internet.
- **Navigateur** : **Google Chrome** ou **Microsoft Edge** uniquement. Utilisez toujours **le même** navigateur : vos visites y sont enregistrées.
- **Créer une visite** : bouton `Nouvelle visite`, choisissez « Visite technique » ou « Réunion », puis le titre, la date et le site.
- Tout est **enregistré automatiquement** : l’indicateur « Enregistré » s’affiche en haut à droite de la visite.

## 2. Pendant et après la visite

- **Informations générales** : rédacteur, objet, site, participants (cochez « Présent » ou non). Tapez le nom puis `Entrée` pour ajouter le participant suivant.
- **Notes** : une section par zone (toiture, quais, sprinklage…). `Insérer la trame visite technique` crée les sections usuelles. Une ligne commençant par « - » devient une puce dans le rapport.
- **Points d’attention** : saisissez l’action, la priorité, le responsable et l’échéance, puis `Entrée`. Les points en retard sont signalés en rouge.
- **Photos** : glissez les photos sur l’onglet ou `Ajouter des photos`. Ajoutez une légende et une catégorie (désordre, sécurité…).
- **Photos d’iPhone (HEIC)** : non prises en charge. Sur l’iPhone : **Réglages › Appareil photo › Formats › « Le plus compatible »**, ou partagez la photo en JPEG.
- **Plan** : depuis AutoCAD, « Tracer » ou « Exporter » en **PDF** (ou en **PNG**), puis `Importez le plan`. Pour un PDF de plusieurs pages, choisissez la page.

**Placer une photo sur le plan**, au choix :

- **glisser** la miniature du panneau de droite et la **déposer** sur le plan ;
- **cliquer** sur la miniature, puis **cliquer** sur le plan à l’endroit voulu (`Échap` pour annuler) ;
- **au clavier** : `Entrée` sur la miniature, puis `Entrée` sur le plan (le repère est posé au centre de la vue).

Chaque photo a un seul repère numéroté ; le replacer le déplace. Cliquez sur un repère pour lui donner une étiquette ou le retirer.

## 3. Suivre un site d’une visite à l’autre

Pour la visite suivante du même site, **dupliquez** la visite : menu `⋯` de la visite, puis `Dupliquer`. La copie est datée du jour.

| Repris dans la copie | Non repris |
| --- | --- |
| Site et participants (marqués absents) | Notes par zone |
| Points d’attention non terminés | Photos et repères |
| Sinistres DO, contrats d’assurance | Points d’attention terminés |
| Projets et coûts, plans |  |

La visite d’origine ne change pas : elle garde l’état du dossier à sa date.

## 4. DO, assurances, projets et coûts

- **Saisie rapide** : dans chaque tableau, remplissez la ligne du haut puis `Entrée`. Tout se modifie ensuite directement dans le tableau ; une suppression peut être annulée (`Annuler` dans le message).
- **Sinistre DO** : `Déclarer un sinistre` crée les 10 étapes, de la déclaration à la clôture. Passez chaque étape à « Terminé » au fur et à mesure ; `Non applicable` retire une étape.
- **Délais** : l’outil calcule les échéances de l’assureur (position sur la garantie à 60 jours, proposition d’indemnité à 90 jours) à partir de l’accusé de réception, ou à défaut de la déclaration. **Ces délais sont indicatifs** (art. L242-1 du Code des assurances) : vérifiez-les toujours sur le contrat.
- **Contrats** : la validité s’affiche (« Expire dans 23 j » en orange, « Expiré » en rouge).
- **Coûts** : montant HT et taux de TVA ; la TVA et le TTC sont calculés. Les totaux sont donnés par stade : estimation, devis reçu, engagé, facturé.
- `Copier pour Excel` copie tout le tableau des coûts : collez-le dans Excel avec `Ctrl+V`. Si la copie est impossible, un fichier CSV est téléchargé à la place.

## 5. Générer le rapport Word

- Onglet **Rapport** : cochez les rubriques voulues (les rubriques vides sont omises).
- Choisissez **6 photos par page** (ou 2 en grand format) et la qualité des images : **Allégée** pour un envoi par mail.
- Les **points à vérifier** (photos sans légende, rédacteur manquant…) ne bloquent pas : cliquez dessus pour les corriger.
- `Générer le rapport Word` : le fichier « CR - site - date.docx » est téléchargé. Ouvrez-le dans Word pour le relire ou le compléter.
- Le rapport est **la seule copie durable** de la visite : enregistrez-le sur le réseau ou dans le dossier du site.

## 6. Vos données

- Les visites sont enregistrées **dans le navigateur de ce poste uniquement** : elles ne sont ni sur Internet, ni sur un serveur, ni sur un autre ordinateur.
- **Ne videz pas les données de navigation** (« Cookies et autres données de site ») : vos visites seraient effacées. Évitez aussi la navigation privée.
- **Générez le rapport Word** de chaque visite terminée : c’est votre archive.
- **Nouvelle version de l’outil** : remplacez simplement l’ancien fichier HTML par le nouveau ; vos visites sont conservées, tant que vous utilisez le même navigateur sur le même poste.
- **Changement de poste** : les visites ne suivent pas. Avant le changement, générez les rapports Word des visites en cours et conservez-les.
- **Espace bientôt plein** (message en bas de page) : générez les rapports, puis supprimez les anciennes visites.

## 7. Raccourcis clavier

| Où | Touche | Action |
| --- | --- | --- |
| Saisies rapides | `Entrée` | Ajouter la ligne |
| Onglets | `←` `→` | Onglet précédent / suivant |
| Galerie photos | `Alt+←` `Alt+→` | Déplacer la photo sélectionnée |
| Galerie photos | `Ctrl+A` / `Ctrl+V` | Tout sélectionner / coller une image |
| Visionneuse | `←` `→` / `Échap` | Photo précédente, suivante / fermer |
| Plan | `+` `-` / `0` | Zoomer, dézoomer / ajuster |
| Plan | `↑` `↓` `←` `→` | Déplacer la vue |
| Repère sélectionné | flèches (`Maj` : plus loin) | Déplacer le repère |
| Repère sélectionné | `Suppr` | Retirer le repère |
| Placement d’une photo | `Échap` | Annuler |
