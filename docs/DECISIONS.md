# Décisions structurantes

Journal des choix d'architecture de l'outil **cp-compte-rendu**. Chaque entrée : le choix, puis sa justification.

## 1. Un fichier HTML unique

L'outil est livré sous la forme d'un seul `dist/index.html` (JS, CSS, polices et images inlinés via `vite-plugin-singlefile`, `assetsInlineLimit` maximal, `cssCodeSplit: false`, pas de code splitting).
Les postes n'ont aucun droit d'installation : un fichier qu'on s'envoie par mail et qu'on ouvre d'un double-clic (`file://`) est le seul mode de diffusion viable. `npm run check:single` le garantit à chaque build.

## 2. Pas de backend

Aucun serveur, aucune API : tout s'exécute dans le navigateur.
Cela supprime l'hébergement, l'authentification et la maintenance d'une infrastructure pour un outil temporaire, et l'outil fonctionne hors réseau. Une Content-Security-Policy injectée au build (`default-src 'none'`) interdit en plus toute requête réseau.

## 3. IndexedDB pour le stockage (étape 2)

Les visites, notes et photos seront stockées dans IndexedDB, disponible en `file://` dans Chrome et Edge.
`localStorage` est trop petit (≈ 5 Mo, chaînes uniquement) pour des photos ; IndexedDB stocke des `Blob` et des volumes importants. Contrepartie : les données sont liées au navigateur et au poste — d'où l'export/import de fichiers de visite prévu plus tard.

## 4. Pas d'IA

Les comptes rendus sont générés par gabarits à partir des données saisies.
Aucune donnée ne quitte le poste (confidentialité des sites et des sinistres), le résultat est déterministe et vérifiable, et l'outil fonctionne hors réseau.

## 5. Sortie en .docx

Le rapport final est un document Word (.docx) généré côté navigateur et téléchargé localement.
C'est le format attendu par les Property Managers et leurs interlocuteurs : il reste modifiable après génération, contrairement à un PDF.

## 6. Chrome et Edge uniquement (desktop)

Seuls les navigateurs Chromium récents sont ciblés (build `es2023`, tests e2e sur Chromium).
Ce sont les navigateurs des postes d'entreprise ; se limiter à un seul moteur évite les écarts de comportement d'IndexedDB et de `file://` (notamment avec Firefox), et permet d'utiliser les API récentes sans polyfill.

## 7. Outillage (étape 1)

- **TypeScript 6.0 et non 7.0** : TypeScript 7 (compilateur natif) est sorti, mais `typescript-eslint` ne supporte que `>=4.8.4 <6.1.0`. On reste sur 6.0.x jusqu'à ce que le lint typé soit compatible.
- **Composants shadcn/ui** : sources officielles (style `new-york-v4`) placées dans `src/components/ui/`, adaptées pour `Toaster` en mode clair uniquement (sans `next-themes`). Ils peuvent être régénérés ou complétés avec `npx shadcn@latest add <composant>` grâce à `components.json`.
- **Mode clair uniquement** : la variante `dark:` de Tailwind est liée à une classe `.dark` jamais posée, pour ignorer le thème sombre du système.
