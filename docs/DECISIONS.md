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
`localStorage` est trop petit (≈ 5 Mo, chaînes uniquement) pour des photos ; IndexedDB stocke des `Blob` et des volumes importants. Contrepartie : les données sont liées au navigateur et au poste. L'export/import de visites, prévu à l'origine, a été abandonné pour la V1 (voir 29).

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

## 11. Routeur maison par hash (étape 3)

La navigation utilise `#/…` avec un routeur d'une centaine de lignes (`src/app/router.ts`) plutôt qu'une librairie (React Router, TanStack Router).
Seul le hash fonctionne en `file://`. Trois routes ne justifient pas une dépendance de plusieurs dizaines de Ko dans un fichier unique au budget serré, et le routeur maison donne des routes typées (union discriminée).

## 12. Compteur de repères `nextPinNumber` (étape 3)

Chaque visite porte un compteur `nextPinNumber` qui ne fait qu'augmenter (`allocatePinNumber`). Un numéro de repère n'est donc **jamais réattribué**, même après suppression du plus grand.
Le calcul précédent (« plus grand numéro + 1 ») réattribuait le numéro d'un repère supprimé : un rapport déjà diffusé qui cite le « repère 7 » aurait pu désigner une autre photo. Les visites enregistrées sans ce champ sont normalisées à la lecture (`normalizeVisit` : plus grand numéro + 1), sans nouvelle version Dexie.

## 13. Dialogues, onglets et menus sur éléments natifs plutôt que Radix (étape 3)

`Dialog`, `AlertDialog`, `Tabs` et `DropdownMenu` gardent l'API et les styles de shadcn/ui, mais sont construits sur `<dialog>` (`showModal`), l'API Popover (`popover`, `popovertarget`), le positionnement par ancre CSS et le motif ARIA des onglets. Le tri de la liste utilise un `<select>` natif.
Avec les composants Radix, le fichier grossissait de ~160 Ko, contre un budget de 60 Ko : Radix embarque un moteur de positionnement, la gestion du focus et le verrouillage du défilement, que Chrome et Edge récents fournissent nativement. Les versions natives coûtent quelques Ko, et le clavier, Échap, la fermeture au clic extérieur et la restauration du focus viennent du navigateur. Contrepartie : ces fonctions n'existent pas dans jsdom et sont simulées en test (`src/test/domPolyfills.ts`). Les tests Playwright les vérifient dans un vrai Chromium.

## 14. Opérations pures et coalescence des mises à jour (étape 4)

Toute modification d'une visite passe par une fonction pure d'un module `*Ops.ts`, avec ids et dates fournis par l'appelant. Une règle ESLint et des tests sur objets gelés le vérifient.
L'enregistrement automatique rejoue les modifications (voir `ARCHITECTURE.md`). Un id ou une date calculés dans l'updater différeraient d'une exécution à l'autre. Pour éviter qu'une longue saisie empile des centaines de mises à jour, celles d'un même champ sont coalescées (`coalesceKey`).

## 15. Suggestions par `<datalist>` et zones de texte natives (étape 4)

Les suggestions (rédacteurs, sites, villes, participants, responsables, zones types) utilisent `<datalist>`, et les notes des `<textarea>` qui s'agrandissent via `field-sizing: content`.
Aucune dépendance (pas de combobox ni d'éditeur riche) : quelques Ko pour l'étape, clavier et accessibilité natifs. Le rendu des puces (« - ») est reporté au rapport Word.

## 16. Parseur EXIF maison (étape 5)

La date de prise de vue est lue par un parseur de ~100 lignes (`processing/exif.ts`), limité à `DateTimeOriginal` et aux 128 premiers Ko. L'orientation est appliquée par le navigateur (`createImageBitmap(..., { imageOrientation: 'from-image' })`).
Les bibliothèques EXIF complètes pèsent 20 à 60 Ko pour un seul champ utile ici. Le parseur ne lève jamais d'exception : une structure inattendue donne `null`.

## 17. HEIC refusé avec explication (étape 5)

Les photos HEIC/HEIF (format par défaut de l'iPhone) sont refusées avec un message qui explique le réglage à changer (« Le plus compatible ») ou l'export en JPEG.
Chrome et Edge ne décodent pas le HEIC. Un décodeur WASM (libheif) pèserait plus de 1 Mo, soit plus du double du fichier actuel, pour un cas évitable par un réglage du téléphone.

## 18. Pas de Web Worker pour les photos (étape 5)

Le traitement se fait sur le fil principal, une photo à la fois.
Un worker demanderait soit un fichier de script séparé, impossible avec un fichier unique, soit du code chargé depuis un Blob : plus complexe à construire et à tester, avec la CSP à assouplir. `createImageBitmap` décode déjà hors du fil principal ; il ne reste que le dessin et l'encodage (~0,5 s pour une photo de 12 Mpx, mesuré en e2e). L'interface reste utilisable pendant l'import, avec progression et annulation.

## 19. pdf.js sans worker, build « legacy » (étape 6)

Les plans PDF sont rendus par pdf.js dans le fil principal (« fake worker » via `globalThis.pdfjsWorker`), sans aucune ressource externe (pas de CMaps, polices standard ni WASM).
Un worker exigerait un script séparé (impossible avec un fichier unique) ou du code chargé depuis un Blob (CSP à assouplir). Le rendu d'un plan est ponctuel et prend moins d'une seconde. La build « legacy » est choisie parce que la build moderne exige des API JavaScript plus récentes que Chrome 141 : les postes d'entreprise ne sont pas toujours à jour. Coût : ~1,7 Mo dans `index.html`. Un test de faisabilité e2e (`plan-feasibility.spec.ts`) vérifie ce montage en `file://`, sous la CSP de production.

## 20. Plafond global de 2,5 Mo au lieu de budgets par étape (étape 6)

Les budgets de taille par étape sont remplacés par un plafond global de **2,5 Mo** pour `dist/index.html`.
pdf.js représente à lui seul ~1,7 Mo, que rien ne peut remplacer pour lire les PDF d'AutoCAD. Le reste de l'outil pèse ~0,64 Mo. Il reste ~0,13 Mo de marge, à surveiller pour la génération du rapport Word (étape 10). Plafond relevé à 4 Mo à l'étape 7 (voir 25).

## 21. Plans en PNG et JPEG uniquement (étape 6)

Un plan est stocké en PNG (rendu PDF, ou JPEG 0,9 au-delà de 6 Mo) ou dans le format de l'image importée (PNG, JPEG). WebP, GIF et HEIC sont refusés.
Le plan annoté sera intégré au rapport Word, qui accepte PNG et JPEG. Pour un plan, le PNG conserve la netteté des traits fins et des textes.

## 22. Une photo, un repère (étape 6)

Une photo a au plus un repère. La replacer déplace son repère (même numéro) au lieu d'en créer un second.
Le rapport associe chaque photo à un numéro sur le plan : un numéro par photo évite les ambiguïtés (« quel repère correspond à cette photo ? »), et la numérotation reste stable.

## 23. Délais DO affichés comme indicatifs (étape 7)

Les délais de l'assureur (**60 jours** pour prendre position sur la garantie, **90 jours** pour proposer une indemnité) sont calculés et signalés (« dépassé de 12 j », « dans 5 j »), mais toujours accompagnés de la mention « Délai indicatif (art. L242-1 du Code des assurances), à vérifier selon le contrat ».
Ils reprennent la lecture usuelle de l'article L242-1, mais le point de départ exact, les prorogations (expertise complexe, accord de l'assuré) et les stipulations du contrat peuvent les modifier. L'outil ne connaît pas le contrat : il aide à repérer un retard probable, il ne l'établit pas. Un délai n'est plus signalé dès que l'étape correspondante est terminée ou retirée (non applicable), ou que le dossier est clôturé.

## 24. Accusé de réception prioritaire comme date de référence (étape 7)

La date de référence des délais est, par ordre de priorité : la date de l'étape « Accusé de réception de l'assureur », puis la date de déclaration du sinistre, puis la date de l'étape « Déclaration du sinistre ». Sans aucune de ces dates, aucun délai n'est calculé et l'encadré le demande.
Les délais de l'assureur courent à partir de la réception d'une déclaration **complète**, que l'accusé de réception date de façon fiable. La date d'envoi de la déclaration reste un repli raisonnable tant que l'accusé n'est pas arrivé. L'encadré affiche toujours la source retenue (« à partir de l'accusé de réception du 12/03/2026 »).

## 25. Plafond global relevé à 4 Mo (étape 7)

Le plafond de `dist/index.html` passe de 2,5 Mo à **4 Mo**.
La marge restante (~0,1 Mo) ne suffisait pas pour la génération du rapport Word (étape 10). À 4 Mo, le fichier reste léger à diffuser (courriel, partage) et s'ouvre en moins d'une seconde. pdf.js (~1,7 Mo) reste chargé à la demande, au premier import de PDF.

## 26. TVA arrondie ligne par ligne (étape 8)

La TVA est calculée et arrondie au centime **sur chaque ligne de coût**, et chaque total (projet, groupe, stade, total général) est la **somme des lignes**. On n'applique jamais un taux à un total.
C'est la pratique des factures et devis français, et c'est la seule façon de garantir que le total affiché égale l'addition des montants visibles au-dessus, quel que soit le regroupement choisi. Exemple : trois lignes de 0,05 € HT à 5,5 % ont chacune 0,00 € de TVA ; appliquer 5,5 % au total (0,15 €) donnerait 0,01 €, soit un total qui ne correspond à aucune ligne.

## 27. Export TSV / CSV au format Excel FR plutôt qu'un fichier .xlsx (étape 8)

« Copier pour Excel » place dans le presse-papiers un tableau séparé par des tabulations, que l'on colle dans Excel avec Ctrl+V. Si le presse-papiers est indisponible, un fichier CSV est téléchargé (séparateur `;`, BOM UTF-8 pour les accents, fins de ligne CRLF).
Les montants sont écrits sans symbole ni séparateur de milliers, avec une virgule décimale (`12500,50`), et les taux en pourcentage (`20`, `5,5`) : Excel en français les reconnaît comme des nombres, additionnables avec `=SOMME`. Générer un vrai `.xlsx` demanderait une bibliothèque de plusieurs centaines de Ko (ou un format zippé écrit à la main) pour un gain faible : les Property Managers retravaillent de toute façon le tableau dans leur propre classeur.

## 28. `docx` pour générer le rapport Word (étape 10)

Le rapport est produit par la bibliothèque `docx` (version 9), dans le navigateur, sans serveur. Elle est incluse dans le fichier unique mais **évaluée seulement à la première génération** (import dynamique intégré au bundle, comme pdf.js). Un test de faisabilité (`docx-feasibility.spec.ts`) vérifie la génération en `file://` sous la CSP de production.
C'est la bibliothèque de référence pour écrire du .docx en JavaScript : API déclarative (paragraphes, tableaux, sections, en-têtes, images), maintenue, sans dépendance réseau. Elle pèse ≈ 0,43 Mo avec JSZip, ce qui garde le fichier sous le plafond de 4 Mo (≈ 2,83 Mo). Écrire le XML OOXML à la main aurait été plus léger mais bien plus fragile (un document mal formé déclenche la « réparation » de Word). Le rapport est construit en deux couches : un **modèle pur** (`buildReportModel`, testé, sans `docx`) qui porte toute la logique, puis un **rendu mécanique** (`renderReportDocx`).

## 29. Pas d'export ni d'import de visite en V1 (étape 10)

L'étape prévue d'export / import de fichiers de visite est abandonnée pour la V1. Les visites vivent uniquement dans le navigateur du poste ; **le rapport Word est la seule archive durable**.
Risque accepté : perte des visites en cas de changement de poste, de navigateur, ou si les données de navigation sont vidées. Ce risque est limité pour un outil temporaire, dont chaque visite aboutit de toute façon à un rapport. Mesures compensatoires :

- bandeau d'information dans la liste des visites (fermable, mémorisé) : « Vos visites sont enregistrées dans ce navigateur, sur ce poste uniquement… » ;
- date du dernier rapport affichée sur chaque visite (en-tête et carte de la liste) ;
- avertissement « Aucun rapport n'a été généré pour cette visite » avant une suppression ;
- messages d'espace plein et d'erreur de stockage qui orientent vers la génération des rapports ;
- demande de stockage persistant au démarrage (limite la purge automatique par le navigateur) ;
- rubrique « Vos données » du guide (que faire en cas de changement de poste).

## 30. Pas de table des matières par champ dans le rapport (étape 10)

Le rapport n'a pas de table des matières. Les rubriques utilisent les styles de titres natifs de Word (Titre 1, Titre 2) : le **volet de navigation** de Word les affiche et permet d'y accéder.
Une table des matières Word est un champ (`TOC`) calculé par Word : générée hors de Word, elle est vide ou fausse tant que l'utilisateur n'a pas accepté de « mettre à jour les champs » à l'ouverture. Ce message inquiète et la table serait fausse si on le refuse. Seuls les champs de numérotation des pages (« Page X / Y ») sont utilisés : Word les met à jour seul, sans question.

## 31. Rapport tout en portrait, repères agrandis (étape 10, révisé après retours)

Toutes les pages du rapport sont en **A4 portrait**, plans compris : c'est la demande des Property Managers (impression et lecture à l'écran homogènes). Chaque plan annoté commence sur une nouvelle page, en pleine largeur, suivi du tableau de ses repères.
Un plan d'entrepôt (souvent A3 / A1 paysage) est alors réduit à 17 cm de large. Pour que les numéros restent lisibles, les repères de l'image générée mesurent **4 % du grand côté** (≈ 6 mm sur la page, au lieu de ≈ 2 mm auparavant) et la légende grandit avec eux. À l'écran, les repères gardent leur taille fixe de 28 px.
Première version (abandonnée) : une section paysage par plan, jugée peu pratique et des repères trop petits. La planche photos utilise des tableaux sans bordure à lignes insécables (2 ou 6 photos par page) pour qu'aucune photo ne soit coupée entre deux pages.

## 32. Outillage (étape 1)

- **TypeScript 6.0 et non 7.0** : TypeScript 7 (compilateur natif) est sorti, mais `typescript-eslint` ne supporte que `>=4.8.4 <6.1.0`. On reste sur 6.0.x jusqu'à ce que le lint typé soit compatible.
- **Composants shadcn/ui** : sources officielles (style `new-york-v4`) placées dans `src/components/ui/`, adaptées pour `Toaster` en mode clair uniquement (sans `next-themes`). Ils peuvent être régénérés ou complétés avec `npx shadcn@latest add <composant>` grâce à `components.json`.
- **Locale UTF-8 pour Playwright** : sous un Linux minimal (locale `C`), Chromium enregistre les téléchargements aux noms accentués sous le nom « download ». La configuration Playwright force `LANG=C.UTF-8`. Chrome et Edge sous Windows ne sont pas concernés.
- **Tests et types Node** : `tsconfig.test.json` couvre les tests (types Node, Vitest) ; le code applicatif (`tsconfig.app.json`) n'a pas accès aux API Node. En test, `fake-indexeddb` remplace IndexedDB et le `Blob` natif de Node remplace celui de jsdom, que `structuredClone` ne sait pas copier.
- **Mode clair uniquement** : la variante `dark:` de Tailwind est liée à une classe `.dark` jamais posée, pour ignorer le thème sombre du système.
