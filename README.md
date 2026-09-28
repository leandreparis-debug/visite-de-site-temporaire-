# Comptes rendus de visite — Carrefour Property

Outil **autonome et temporaire** pour les Property Managers de Carrefour Property : il servira à préparer les comptes rendus après les visites techniques d'entrepôts et les réunions importantes (notes, photos, plan avec pins, suivi Dommages-Ouvrage, assurances, projets, coûts, export Word).

- Un **seul fichier `index.html`**, à ouvrir d'un double-clic dans Chrome ou Edge.
- Aucune installation, aucun serveur, aucune connexion réseau requise.
- Pas d'IA : les rapports sont générés par gabarits, **aucune donnée ne sort du poste**.

> ⚠️ **Les données sont stockées dans le navigateur du poste** (IndexedDB, à partir de l'étape 2).
> Elles ne sont ni synchronisées ni sauvegardées ailleurs : changer de PC ou de navigateur, ou vider les données de navigation, les fait disparaître. Utilisez l'export de fichiers de visite (étape ultérieure) pour les conserver ou les transmettre.

**État actuel (étape 5)** : gestion des visites, enregistrement automatique, onglets « Informations générales », « Notes » et « Photos » opérationnels. Les onglets plan, DO, projets et rapport arriveront aux étapes suivantes.

---

## Diffuser l'outil (utilisateurs)

1. Un développeur produit le fichier : `npm run build` puis `npm run check:single`.
2. Il envoie **uniquement `dist/index.html`** (mail, Teams, partage réseau…). Le fichier peut être renommé, par exemple `comptes-rendus-visite.html`.
3. L'utilisateur l'enregistre où il veut (Bureau, Documents…) et l'ouvre **d'un double-clic dans Chrome ou Edge**.

Le fichier fonctionne hors réseau et ne dépend d'aucun autre fichier.
Les données sont liées **au navigateur et au profil utilisateur** du poste : ouvrir le fichier dans Chrome puis dans Edge donne deux espaces de données distincts. Utilisez toujours le même navigateur.

---

## Utilisation

### Premier parcours

1. **Ouvrir l'outil** : double-clic sur le fichier `index.html`, dans Chrome ou Edge.
2. **Créer une visite** : bouton **« Nouvelle visite »** (ou « Créer ma première visite »). Choisir le type (visite technique ou réunion), saisir le titre, la date (aujourd'hui par défaut) et le nom du site, puis **« Créer la visite »** ou la touche Entrée. La visite s'ouvre.
3. **Modifier le titre** : cliquer sur le titre, le corriger, puis Entrée pour valider ou Échap pour annuler.
4. **Rien à enregistrer à la main** : les modifications sont enregistrées automatiquement. L'indicateur en haut à droite affiche « Modifications en cours… », « Enregistrement… », puis « Enregistré ». En cas de problème, il affiche « Erreur d'enregistrement » avec un bouton **« Réessayer »**.
5. **Revenir à la liste** : lien **« ← Visites »**. La liste permet de rechercher par titre ou site (les accents et majuscules sont ignorés), de filtrer par type et de trier.
6. **Reprendre le suivi d'une visite** : menu **« ⋯ »** de la visite, puis **« Dupliquer »**. Le dialogue indique ce qui est repris (site, participants, sinistres DO, assurances, projets, coûts, points d'attention non terminés, plans) et ce qui ne l'est pas (notes, photos, repères). La copie, datée du jour, s'ouvre.
7. **Supprimer une visite** : menu **« ⋯ »**, puis **« Supprimer »**. La suppression est **définitive** : pensez à exporter la visite avant (export disponible à une étape ultérieure).

### Informations générales

- **Visite** : type, date, heure de début, rédacteur et objet. Le champ Rédacteur propose les noms habituels et ceux déjà saisis dans d'autres visites (flèche ↓ ou début de saisie).
- **Site** : nom (obligatoire), code, adresse, ville. Le nom et la ville proposent les valeurs déjà utilisées. Si le nom est vidé par erreur, un message s'affiche et l'ancien nom revient en quittant le champ.
- **Participants, saisie rapide au clavier** : dans la ligne du haut, taper le **nom**, `Tab`, la **fonction**, `Tab`, la **société**, puis `Entrée`. Le participant est ajouté (présent par défaut) et le curseur revient sur Nom pour le suivant. Dans le tableau, tout se modifie directement : case « Présent », flèches pour réordonner, corbeille pour supprimer. Après une suppression, le bouton **« Annuler »** du message la rétablit pendant 5 secondes.

### Notes

- **Trames** : « Insérer une trame » ajoute d'un coup les sections types. La trame visite technique contient les zones d'entrepôt (toiture, façades, quais, sprinklage…), la trame réunion les sections ordre du jour, points abordés, décisions et divers. Les sections déjà présentes ne sont pas dupliquées : on peut insérer une trame plusieurs fois sans risque.
- **Sections** : « Ajouter une section » crée une section et place le curseur sur son titre (des zones types sont proposées). `Tab` passe ensuite au texte. Les boutons permettent de réordonner, replier ou déplier (« Tout replier » pour une vue d'ensemble) et supprimer. Une section contenant du texte demande confirmation avant suppression.
- **Astuce des puces** : commencez une ligne par « - » (tiret puis espace). Elle deviendra une puce dans le rapport Word.
- **Points d'attention et actions** : taper le point, puis `Entrée` (priorité moyenne par défaut ; responsable et échéance facultatifs). Le tableau affiche d'abord les points non terminés, par priorité puis par échéance. Un badge **« En retard »** signale une échéance dépassée. « Masquer les points terminés » allège la liste.

### Photos

- **Ajouter** : bouton « Ajouter des photos », **glisser-déposer** les fichiers sur l'onglet, ou **Ctrl+V** pour coller une capture d'écran. Plusieurs photos à la fois : elles sont rangées par date de prise de vue (sinon par nom de fichier). Une barre indique la progression et permet d'annuler.
- **Formats acceptés** : JPEG, PNG, WebP (40 Mo maximum par fichier). Les photos sont **automatiquement allégées** (2000 px, ~300 à 600 Ko) et remises dans le bon sens. **La photo d'origine n'est pas conservée** : seule la version allégée est stockée, gardez vos originaux sur le téléphone ou le PC si besoin.
- **iPhone (HEIC)** : les photos HEIC ne sont pas prises en charge. Sur l'iPhone : **Réglages › Appareil photo › Formats › « Le plus compatible »** (les nouvelles photos seront en JPEG), ou exportez/partagez la photo en JPEG. Les fichiers refusés sont listés avec leur raison (bouton « Détails » du message de fin d'import).
- **Légende et catégorie** : directement sur chaque photo, ou dans la visionneuse (clic sur la photo). Enregistrées automatiquement.
- **Raccourcis clavier** :
  - dans la galerie : `Alt+←` / `Alt+→` déplace la photo qui a le focus, `Ctrl+A` sélectionne toutes les photos affichées, `Ctrl+V` colle une image ;
  - dans la visionneuse : `←` / `→` pour la photo précédente ou suivante, `Échap` pour fermer.
- **Réorganiser** : glisser-déposer une photo, les raccourcis ci-dessus, ou le menu « ⋯ » (déplacer au début ou à la fin, pivoter, supprimer).
- **Sélection multiple** : cocher les photos pour changer leur catégorie ou les supprimer d'un coup. Si une photo porte un repère sur le plan, la confirmation l'indique (« 2 repères seront retirés du plan (n°4, n°9) »). Les numéros de repère ne sont jamais réattribués.

L'adresse de la page (par exemple `…/index.html#/visits/…/notes`) mémorise la visite et l'onglet ouverts : un rechargement ramène au même endroit.

Le pied de page indique l'espace utilisé dans le navigateur. Il passe en orange au-delà de 80 % du quota.

---

## Où sont stockées les données

Toutes les données (visites, notes, photos, plans…) sont enregistrées **dans le navigateur, sur le poste**, dans une base IndexedDB nommée `cp-compte-rendu`. Rien n'est envoyé sur un serveur ni sur Internet.

Limites à connaître :

- **Propres au navigateur et au poste** : Chrome et Edge ont chacun leur propre stockage, et un autre PC ou un autre profil Windows ne voit pas les mêmes visites.
- **Effacées si l'utilisateur vide les données du navigateur** (« Effacer les données de navigation » → « Cookies et autres données de site »), ou par une politique de nettoyage du poste.
- **Pas de navigation privée** : les données y sont supprimées à la fermeture, et IndexedDB peut y être indisponible. L'outil affiche alors « Stockage indisponible ».
- **Espace limité** : le navigateur accorde un quota (généralement une part importante du disque libre). En cas de dépassement, le message « Espace de stockage du navigateur insuffisant. Exportez puis supprimez d'anciennes visites. » s'affiche.
- Au démarrage, l'outil demande au navigateur un stockage **persistant**, pour éviter une purge automatique quand le disque est plein. Le navigateur peut refuser sans prévenir.

➡️ Pour conserver ou transmettre une visite, utiliser l'**export de fichier de visite** (étape 9). Détail du modèle : [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

---

## Développement

### Prérequis

- **Node.js LTS** (≥ 22.22.2 ; Node 24 recommandé, voir `.nvmrc`) et npm.
- Pour les tests e2e : Chromium pour Playwright, installé une fois avec `npx playwright install chromium`.
  Si l'installation est impossible, indiquer un Chrome/Chromium existant : `PW_CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.

```bash
npm install
npm run dev
```

### Commandes

| Commande               | Rôle                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| `npm run dev`          | Serveur de développement Vite avec rechargement à chaud.                  |
| `npm run build`        | Vérification TypeScript (`tsc -b`) puis build → `dist/index.html` unique. |
| `npm run preview`      | Sert le build localement (le vrai usage reste l'ouverture en `file://`).  |
| `npm run typecheck`    | Vérification des types, sans build.                                       |
| `npm run lint`         | ESLint (règles TypeScript typées, React Hooks, React Refresh).            |
| `npm run format`       | Formate tout le code avec Prettier (tri des classes Tailwind inclus).     |
| `npm run format:check` | Vérifie le formatage sans modifier les fichiers.                          |
| `npm run test`         | Tests unitaires Vitest (une exécution).                                   |
| `npm run test:watch`   | Tests unitaires Vitest en mode surveillance.                              |
| `npm run test:e2e`     | Build puis tests Playwright sur `dist/index.html` ouvert en `file://`.    |
| `npm run check:single` | Vérifie que `dist/` ne contient que `index.html`, sans référence externe. |

Vérification complète avant diffusion :

```bash
npm run typecheck && npm run lint && npm run test && npm run build && npm run check:single && npm run test:e2e
```

### Remplacer le logo

> ℹ️ **Le logo actuel est PROVISOIRE** : `src/assets/logo/carrefour-property.svg` est une pastille bleue avec le texte « Carrefour Property », créée faute de logo officiel. Il doit être remplacé.

1. Déposer le logo officiel dans `src/assets/logo/` sous le nom **`carrefour-property.svg`** (recommandé) ou **`carrefour-property.png`**.
2. Si vous utilisez un PNG, **supprimer** le SVG provisoire (le SVG est prioritaire quand les deux existent).
3. `npm run build` : le logo est automatiquement inliné dans `index.html`.
4. Ajuster si besoin `--color-brand` dans `src/styles/globals.css` sur le bleu exact du logo.

Pour un PNG, prévoir une hauteur d'au moins 64 px (affichage à 32 px, écrans haute densité).

### Arborescence

```
├── index.html                 # Gabarit HTML (lang="fr"), point d'entrée Vite
├── vite.config.ts             # Build fichier unique, alias @/, CSP hors-ligne, config Vitest
├── playwright.config.ts       # Tests e2e (Chromium)
├── eslint.config.js           # ESLint flat config
├── components.json            # Configuration shadcn/ui
├── docs/
│   ├── ARCHITECTURE.md        # Couches, routage par hash, enregistrement automatique
│   ├── DATA_MODEL.md          # Modèle de données (entités, règles, diagramme)
│   └── DECISIONS.md           # Choix structurants
├── scripts/
│   ├── check-single-file.mjs  # Contrôle du build (fichier unique, aucune ressource externe)
│   └── make-photo-fixtures.mjs # Génère tests/fixtures/photos (JPEG EXIF II/MM, orientation 6, PNG…)
├── tests/e2e/
│   ├── smoke.spec.ts          # Ouverture de dist/index.html en file:// (console, réseau)
│   ├── storage.spec.ts        # IndexedDB + Blob persistants après rechargement en file://
│   ├── visits.spec.ts         # Parcours complet : créer, renommer, recharger, dupliquer, supprimer
│   ├── general-notes.spec.ts  # Informations générales, participants, notes, points d'attention
│   └── photos.spec.ts         # Import de vrais fichiers, EXIF, orientation, visionneuse, rotation…
└── src/
    ├── main.tsx               # zod-setup (1er import), montage React, erreurs globales, init stockage
    ├── app/
    │   ├── App.tsx            # Coquille : header, page selon la route, footer, Toaster
    │   ├── router.ts, Link.tsx # Routeur par hash (useRoute, navigate, <Link>)
    │   ├── ErrorBoundary.tsx  # Erreur de rendu : message FR + « Recharger l'outil »
    │   ├── globalErrorHandlers.ts # window.onerror / unhandledrejection → toast
    │   └── initStorage.ts     # Stockage persistant + vérification d'IndexedDB au démarrage
    ├── assets/logo/           # Logo Carrefour Property (provisoire, à remplacer)
    ├── components/
    │   ├── ui/                # Composants shadcn/ui (dialog, tabs, dropdown-menu : version native)
    │   ├── form/              # DraftInput/DraftTextarea (champs liés au brouillon), SegmentedControl,
    │   │                      # NativeSelect, IconButton
    │   ├── brand/BrandLogo.tsx
    │   └── layout/            # AppHeader, AppFooter (espace utilisé), EmptyState
    ├── features/              # Code métier, un dossier par fonctionnalité
    │   ├── general/           # Onglet Informations générales : GeneralTab, participantOps,
    │   │                      # visitInfoOps, suggestions (datalist)
    │   ├── notes/             # Onglet Notes : sections, trames, points d'attention (Ops + View)
    │   ├── photos/            # Onglet Photos : galerie, visionneuse, import, processing/ (EXIF, redimensionnement)
    │   ├── visits/            # visitsRepo, visitFactory, useVisits, useVisitDraft (autosave),
    │   │                      # VisitListPage, VisitEditorPage, dialogues création/duplication/suppression
    │   ├── photos/            # photosRepo, usePhotos
    │   └── plan/              # plansRepo, usePlans, pins (allocatePinNumber)
    ├── lib/
    │   ├── db/                # db.ts (Dexie), storage.ts (quota, persistance), meta.ts, useLiveResult
    │   ├── errors.ts          # Erreurs typées + toUserMessage()
    │   ├── money.ts           # Centimes, TVA, saisie et affichage en euros
    │   ├── dates.ts           # Dates ISO, format français
    │   ├── id.ts              # createId() (UUID v4)
    │   ├── validation.ts      # parseOrThrow() → ValidationError
    │   ├── notify.ts          # notifyError() (toast FR), pluralize()
    │   ├── search.ts          # Recherche insensible aux accents
    │   ├── useNow.ts          # Heure courante rafraîchie (« Modifiée il y a … »)
    │   ├── useObjectUrl.ts    # Seul point de création des URL blob:
    │   ├── zod-setup.ts       # Config Zod (jitless, messages FR)
    │   └── utils.ts           # cn() (fusion de classes Tailwind)
    ├── styles/globals.css     # Tailwind v4 + tokens du design system (@theme)
    ├── test/                  # Setup Vitest (fake-indexeddb, jest-dom, polyfills dialog/popover), fixtures
    └── types/                 # Schémas Zod (visit, media, common) + labels.ts (libellés FR)
```

Règle d'organisation : **tout nouveau code métier va dans `src/features/<feature>/`** (composants, logique, tests de la fonctionnalité). `components/` ne contient que des éléments génériques réutilisables.

### Conventions

- Interface en **français** ; code, noms de fichiers, variables et commentaires techniques en **anglais**.
- Aucune ressource externe au runtime : pas de CDN, pas de Google Fonts, aucun appel réseau (police système : Segoe UI sous Windows). La CSP du build bloque toute requête.
- Pas d'import dynamique : tout doit rester dans le fichier unique.
- Données : les composants lisent via les hooks et écrivent via les repositories, jamais via `db` (validation, transactions). Montants en centimes, dates `YYYY-MM-DD`. Zod s'importe depuis `zod/mini`.
- Édition : passer par `useVisitDraft` et des `update` **purs** (logique dans les modules `*Ops.ts`, ids et dates générés dans le gestionnaire d'événement, voir `docs/ARCHITECTURE.md`). Chaque erreur d'action s'affiche avec `notifyError()`.
- Pas de nouvelle dépendance lourde : le fichier unique a un budget de taille (voir `docs/DECISIONS.md`).
- Couleurs : utiliser les tokens (`bg-brand`, `text-muted-foreground`, `bg-success`…) plutôt que des valeurs en dur. `accent-red` / `danger` sont réservés aux alertes et statuts critiques.
