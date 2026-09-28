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

## 7. Dexie pour IndexedDB (étape 2)

L'accès à IndexedDB passe par Dexie (transactions, index composés, `liveQuery`) et `dexie-react-hooks` pour des hooks réactifs.
L'API IndexedDB brute est verbeuse et source d'erreurs (transactions, curseurs) ; Dexie pèse ~98 Ko minifié mais simplifie nettement les cascades, la duplication et la réactivité de l'UI.

## 8. Zod (`zod/mini`) en mode `jitless`

Les schémas Zod sont la source de vérité du modèle (types inférés). On utilise `zod/mini`, l'API fonctionnelle de Zod 4 : même moteur, mais ~20 Ko au lieu de ~83 Ko pour l'API classique. C'est ce qui permet de tenir le budget de taille du fichier unique ; une règle ESLint interdit l'import de `zod`.
`z.config({ jitless: true })` est appelé en tout premier dans `main.tsx` (`src/lib/zod-setup.ts`) : l'API classique compile ses parseurs avec `new Function`, ce que la CSP (`default-src 'none'`, sans `unsafe-eval`) bloque en loguant une erreur. `zod/mini` ne compile pas, mais le réglage protège d'une régression.

## 9. Montants en centimes entiers

Tous les montants sont des entiers en centimes, et la TVA est exprimée en points de base (`2000` = 20 %).
Les flottants produisent des écarts d'arrondi (`0.1 + 0.2 ≠ 0.3`) inacceptables dans un rapport de coûts. La TVA est arrondie au centime par ligne, comme sur une facture.

## 10. Blobs dans des tables séparées

Les photos et les plans sont stockés en `Blob` dans les tables `photos` et `plans`, jamais dans l'objet visite. Seuls les repères (légers) restent dans la visite.
Lister les visites ne charge ainsi aucun binaire, et une visite reste un petit objet JSON facile à valider, dupliquer et exporter.

## 11. Outillage (étape 1)

- **TypeScript 6.0 et non 7.0** : TypeScript 7 (compilateur natif) est sorti, mais `typescript-eslint` ne supporte que `>=4.8.4 <6.1.0`. On reste sur 6.0.x jusqu'à ce que le lint typé soit compatible.
- **Composants shadcn/ui** : sources officielles (style `new-york-v4`) placées dans `src/components/ui/`, adaptées pour `Toaster` en mode clair uniquement (sans `next-themes`). Ils peuvent être régénérés ou complétés avec `npx shadcn@latest add <composant>` grâce à `components.json`.
- **Tests et types Node** : `tsconfig.test.json` couvre les tests (types Node, Vitest) ; le code applicatif (`tsconfig.app.json`) n'a pas accès aux API Node. En test, `fake-indexeddb` remplace IndexedDB et le `Blob` natif de Node remplace celui de jsdom, que `structuredClone` ne sait pas copier.
- **Mode clair uniquement** : la variante `dark:` de Tailwind est liée à une classe `.dark` jamais posée, pour ignorer le thème sombre du système.
