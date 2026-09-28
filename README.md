# Comptes rendus de visite — Carrefour Property

Outil **autonome et temporaire** pour les Property Managers de Carrefour Property : il servira à préparer les comptes rendus après les visites techniques d'entrepôts et les réunions importantes (notes, photos, plan avec pins, suivi Dommages-Ouvrage, assurances, projets, coûts, export Word).

- Un **seul fichier `index.html`**, à ouvrir d'un double-clic dans Chrome ou Edge.
- Aucune installation, aucun serveur, aucune connexion réseau requise.
- Pas d'IA : les rapports sont générés par gabarits, **aucune donnée ne sort du poste**.

> ⚠️ **Les données sont stockées dans le navigateur du poste** (IndexedDB, à partir de l'étape 2).
> Elles ne sont ni synchronisées ni sauvegardées ailleurs : changer de PC ou de navigateur, ou vider les données de navigation, les fait disparaître. Utilisez l'export de fichiers de visite (étape ultérieure) pour les conserver ou les transmettre.

**État actuel (étape 1)** : fondations uniquement — coquille de l'application, design system et outillage. Aucune fonctionnalité métier.

---

## Diffuser l'outil (utilisateurs)

1. Un développeur produit le fichier : `npm run build` puis `npm run check:single`.
2. Il envoie **uniquement `dist/index.html`** (mail, Teams, partage réseau…). Le fichier peut être renommé, par exemple `comptes-rendus-visite.html`.
3. L'utilisateur l'enregistre où il veut (Bureau, Documents…) et l'ouvre **d'un double-clic dans Chrome ou Edge**.

Le fichier fonctionne hors réseau et ne dépend d'aucun autre fichier.
Les données sont liées **au navigateur et au profil utilisateur** du poste : ouvrir le fichier dans Chrome puis dans Edge donne deux espaces de données distincts. Utilisez toujours le même navigateur.

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
│   └── DECISIONS.md           # Choix structurants
├── scripts/
│   └── check-single-file.mjs  # Contrôle du build (fichier unique, aucune ressource externe)
├── tests/
│   └── e2e/smoke.spec.ts      # Ouverture de dist/index.html en file:// (console, réseau)
└── src/
    ├── main.tsx               # Montage React + écoute des erreurs globales
    ├── app/
    │   ├── App.tsx            # Coquille : header + zone principale + Toaster
    │   ├── ErrorBoundary.tsx  # Erreur de rendu : message FR + « Recharger l'outil »
    │   └── globalErrorHandlers.ts # window.onerror / unhandledrejection → toast
    ├── assets/logo/           # Logo Carrefour Property (provisoire, à remplacer)
    ├── components/
    │   ├── ui/                # Composants shadcn/ui (button, card, dialog…)
    │   ├── brand/BrandLogo.tsx
    │   └── layout/            # AppHeader, EmptyState
    ├── features/              # Code métier, un dossier par fonctionnalité (à venir)
    ├── lib/utils.ts           # cn() (fusion de classes Tailwind)
    ├── styles/globals.css     # Tailwind v4 + tokens du design system (@theme)
    ├── test/setup.ts          # Initialisation Vitest (jest-dom)
    └── types/                 # Types partagés (à venir)
```

Règle d'organisation : **tout nouveau code métier va dans `src/features/<feature>/`** (composants, logique, tests de la fonctionnalité). `components/` ne contient que des éléments génériques réutilisables.

### Conventions

- Interface en **français** ; code, noms de fichiers, variables et commentaires techniques en **anglais**.
- Aucune ressource externe au runtime : pas de CDN, pas de Google Fonts, aucun appel réseau (police système : Segoe UI sous Windows). La CSP du build bloque toute requête.
- Pas d'import dynamique : tout doit rester dans le fichier unique.
- Couleurs : utiliser les tokens (`bg-brand`, `text-muted-foreground`, `bg-success`…) plutôt que des valeurs en dur. `accent-red` / `danger` sont réservés aux alertes et statuts critiques.
