# Architecture

Vue d'ensemble du fonctionnement de l'application (fichier unique `index.html`, ouvert en `file://`, sans serveur). Les choix structurants et leurs raisons sont dans [`DECISIONS.md`](DECISIONS.md), le modèle de données dans [`DATA_MODEL.md`](DATA_MODEL.md).

## Couches

```
Composants React (src/features/*/…Page.tsx, dialogues)
        │  lisent via les hooks, écrivent via les repositories
        ▼
Hooks (useVisitSummaries, useVisit, useVisitDraft, usePhotos…)
        │  useLiveQuery (Dexie) : se mettent à jour quand la base change
        ▼
Repositories (visitsRepo, photosRepo, plansRepo)
        │  validation Zod, transactions, erreurs typées
        ▼
Dexie → IndexedDB (base « cp-compte-rendu »)
```

**Règle : les composants ne touchent jamais `db` directement.** Toute lecture passe par un hook, toute écriture par une fonction de repository. C'est ce qui garantit la validation à chaque écriture, les cascades en transaction et la traduction des erreurs en messages français. Seuls les tests peuvent préparer des données directement dans `db`.

Toute erreur d'une action utilisateur est affichée en toast via `notifyError()` (`src/lib/notify.ts`), qui passe par `toUserMessage()`. Aucune erreur n'est ignorée silencieusement.

## Routage par hash

`src/app/router.ts` est un routeur minimal, écrit pour le projet (~100 lignes) :

| Hash                | Écran                                |
| ------------------- | ------------------------------------ |
| `#/`                | Liste des visites                    |
| `#/visits/:id`      | Redirigé vers `#/visits/:id/general` |
| `#/visits/:id/:tab` | Édition de la visite, onglet `:tab`  |

- **Pourquoi le hash** : ouvert en `file://`, le fichier ne peut pas servir d'autres chemins (`/visits/…` pointerait vers un fichier inexistant). Le fragment `#…` fonctionne en `file://`, survit au rechargement, et le bouton Précédent du navigateur marche.
- Un onglet inconnu redirige vers `general`, une route inconnue vers `#/`. Ces redirections utilisent `history.replaceState` et n'ajoutent donc pas d'entrée d'historique.
- API : `useRoute()` (route typée en union discriminée), `navigate(route)`, `<Link to={route}>` (un vrai `<a href="#/…">` : clic molette, copie de lien et clavier fonctionnent).
- L'écran d'édition est rendu avec `key={visitId}` : changer de visite recrée proprement son état.

## Enregistrement automatique (`useVisitDraft`)

Brique commune à tous les écrans d'édition. `useVisitDraft(id)` retourne `{ draft, update, status, error, flush, discard }`.

**Stratégie : le brouillon local fait foi tant qu'il contient des modifications non enregistrées.**

- Chaque `update(fn)` ajoute `fn` à une **file de modifications en attente**, et l'affichage se met à jour immédiatement. Le brouillon affiché est « dernière version connue de la visite + modifications en attente ».
- La sauvegarde part **800 ms après la dernière modification**, ou immédiatement avec `flush()`. Elle **rejoue** les modifications en attente dans `visitsRepo.updateVisit`, sur la version actuellement en base. Une modification faite entre-temps par une autre action est donc conservée, et un champ en cours de saisie ne « saute » jamais.
- Tant que rien n'est en attente, le brouillon suit la base (requête réactive) : il se resynchronise après une action extérieure.
- Les sauvegardes sont **sérialisées** : une seule à la fois. Une modification faite pendant une sauvegarde reste en attente et part au cycle suivant.
- `flush()` est appelé : au changement d'onglet, au retour à la liste, au démontage, sur `pagehide` et quand la page devient cachée (`visibilitychange`). `beforeunload` déclenche l'avertissement natif du navigateur s'il reste des modifications non enregistrées.
- En cas d'erreur (validation, stockage) : statut `error`, toast en français, les modifications restent en attente, et **aucune nouvelle tentative automatique** n'a lieu tant que l'utilisateur ne modifie rien ou ne clique pas sur « Réessayer ».
- Avant une duplication, l'écran d'édition appelle `flush()` pour que la copie contienne les dernières modifications. Avant une suppression, il appelle `discard()` : les modifications en attente sont abandonnées puisque la visite disparaît.
- `updatedAt` est géré par le repository, pas par le hook.

Contrainte pour les étapes suivantes : un `update` doit être une **fonction pure** de la visite reçue (`(v) => ({ ...v, title })`), car elle peut être rejouée sur une version plus récente. Voir « Règle des fonctions pures » ci-dessous.

**Coalescence** : `update(fn, { coalesceKey: 'site.city' })` remplace la mise à jour en attente précédente si elle porte la même clé, au lieu d'en ajouter une nouvelle. Pendant la saisie d'un champ, la file garde ainsi une seule entrée par champ au lieu d'une par frappe. À réserver aux mises à jour « mettre ce champ à cette valeur », où la nouvelle remplace entièrement l'ancienne. Une mise à jour déjà en cours d'écriture n'est jamais remplacée.

**Champs liés au brouillon** (`src/components/form/DraftFields.tsx`) : pendant la saisie, `DraftInput` et `DraftTextarea` affichent une **copie locale** de ce qui est tapé et transmettent chaque changement au brouillon. À la perte du focus, ils réaffichent la valeur du brouillon. Le nettoyage des espaces ou le refus d'une valeur ne fait donc jamais sauter le curseur. Un champ obligatoire vidé (nom du site, nom d'un participant, titre de section) affiche une erreur, n'envoie rien, puis retrouve sa valeur précédente à la perte du focus : aucun état invalide n'est envoyé à l'enregistrement.

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant E as Écran d'édition
    participant H as useVisitDraft
    participant R as visitsRepo.updateVisit
    participant DB as IndexedDB (Dexie)

    U->>E: saisit « A », « AB », « ABC »
    E->>H: update(fn1), update(fn2), update(fn3)
    H-->>E: brouillon affiché = base + fn1..fn3 (statut « dirty »)
    Note over H: minuteur 800 ms relancé à chaque update
    H->>H: 800 ms sans modification → flush()
    H-->>E: statut « saving »
    H->>R: updateVisit(id, current => fn3(fn2(fn1(current))))
    R->>DB: transaction : lecture, rejeu, validation Zod, updatedAt, écriture
    alt succès
        DB-->>R: OK
        R-->>H: visite enregistrée
        H-->>E: statut « saved », file vidée
        DB-->>H: requête réactive → nouvelle version (ignorée si plus ancienne)
    else ValidationError / stockage plein
        R-->>H: erreur typée
        H-->>E: statut « error » + toast FR, modifications conservées
        Note over H: pas de nouvelle tentative avant le prochain update ou « Réessayer »
    end
```

## Règle des fonctions pures

Toute fonction passée à `update` peut être exécutée **plusieurs fois** : au rendu (brouillon affiché = base + modifications en attente), puis à chaque tentative de sauvegarde, où elle est **rejouée** sur la version en base. Elle doit donc être **pure et déterministe** : même visite en entrée, même résultat, sans effet de bord ni mutation.

- **Aucun `createId()`, `Date.now()`, `new Date()`, `todayIso()` ou `Math.random()` dans un updater.** Les identifiants et les dates sont calculés **dans le gestionnaire d'événement**, puis passés en argument.
- La logique de modification vit dans des modules d'opérations purs et testés (`src/features/*/…Ops.ts`). Les composants se contentent d'appeler `update((v) => addParticipant(v, participant))`.
- Ne jamais muter la visite reçue : retourner de nouveaux objets. Les tests appliquent chaque opération à une visite **profondément gelée** (`deepFreeze`).
- ESLint interdit, dans les fichiers `*Ops.ts`, l'import de `@/lib/id`, de `todayIso` et `nowIso`, ainsi que `Date.now()`, `new Date()`, `Math.random()` et `crypto.*`.

✅ Correct : l'identifiant est généré une seule fois, dans le gestionnaire.

```ts
const onAdd = () => {
  const participant = { id: createId(), name: entry.name } // ici, une seule fois
  update((v) => addParticipant(v, participant))
}
```

❌ Incorrect : l'identifiant est généré dans l'updater.

```ts
update((v) => addParticipant(v, { id: createId(), name: entry.name }))
```

Ici, l'updater est exécuté une fois pour l'affichage, puis de nouveau à la sauvegarde. Chaque exécution produit un nouvel identifiant : le participant affiché n'a pas le même id que celui enregistré. Les actions suivantes (modifier, supprimer, « Annuler ») visent alors un id qui n'existe pas en base. En cas d'erreur puis de nouvelle tentative, un nouvel id serait encore généré. Même problème avec une date : « aujourd'hui » calculé dans l'updater changerait si la sauvegarde avait lieu après minuit.

Les valeurs d'affichage qui dépendent du temps (« En retard », « Modifiée il y a… ») sont calculées **au rendu** (`useToday`, `useNow`), jamais stockées par un updater.

## Pipeline photo

Chaque fichier importé est traité **dans le navigateur**, un à la fois, sans dépendance ni Web Worker (`src/features/photos/processing/`). Seule la version allégée est conservée ; le fichier d'origine ne l'est pas.

```mermaid
flowchart LR
    F[Fichier choisi, déposé ou collé] --> C{Contrôles}
    C -- HEIC/HEIF, non-image, > 40 Mo --> X[Ignoré + raison en français]
    C --> E[EXIF : DateTimeOriginal<br/>128 premiers Ko, parseur maison]
    E --> D["Décodage + orientation<br/>createImageBitmap(imageOrientation: 'from-image')"]
    D -- échec --> X
    D --> R[Redimensionnement<br/>2000 px max, jamais d'agrandissement]
    R --> J1[Encodage JPEG 0,82<br/>fond blanc sous la transparence]
    D --> T[Miniature 480 px max]
    T --> J2[Encodage JPEG 0,7]
    J1 & J2 --> S[(photosRepo.addPhoto<br/>table photos)]
    D -. close dans un finally .-> Z[ImageBitmap libéré]
```

| Variante         | Grand côté max. | Qualité JPEG | Usage                                  |
| ---------------- | --------------- | ------------ | -------------------------------------- |
| Image principale | 2000 px         | 0,82         | Visionneuse, rapport Word              |
| Miniature        | 480 px          | 0,7          | Galerie (seules les miniatures y sont) |

**Pourquoi ces valeurs** : une photo pleine largeur dans un rapport A4 (≈ 17 cm à 300 dpi) demande environ 2000 px, donc elle reste nette à l'impression. En JPEG 0,82, une photo de téléphone de 12 Mpx (3 à 6 Mo) descend à **300–600 Ko environ**, soit 5 à 10 fois moins d'espace dans le navigateur. La miniature à 480 px reste nette dans une grille de 4 à 5 colonnes, même sur écran haute densité.

- **Encodage** : `OffscreenCanvas.convertToBlob`, ou `<canvas>.toBlob` en repli. Les PNG et WebP sont aplatis sur fond blanc puis convertis en JPEG.
- **Rotation** (`rotateBlob90`) : l'image principale est redessinée tournée de 90°, puis image et miniature sont réencodées (largeur et hauteur échangées).
- **Import** (`runPhotoImport`) : ordre par date EXIF, sinon par nom en tri naturel. Traitement séquentiel. Un échec n'arrête pas les autres. Un espace plein (`StorageQuotaError`) arrête proprement l'import. L'annulation prend effet après la photo en cours.
- **Codec injectable** : `processPhoto(file, codec)` et `rotateBlob90(blob, dir, codec)` reçoivent décodeur et encodeur. Les tests unitaires (jsdom, sans canvas) vérifient la logique, et Playwright vérifie le vrai traitement dans Chromium.
- **Métadonnées** (légende, catégorie) : enregistrées directement par `photosRepo` via `usePhotoMetaSaver`, 600 ms après la frappe et à la perte du focus, car les photos ne passent pas par le brouillon de la visite.
- **Affichage** : miniatures seulement dans la grille (`loading="lazy"`, `content-visibility: auto`), image principale seulement dans la visionneuse, qui précharge la suivante. `useObjectUrl` partage une URL `blob:` par Blob et ne la révoque qu'un instant après son dernier usage. Sans ce délai, passer de la photo préchargée à la photo affichée révoquait une URL en cours de chargement.
- **Cache Dexie `immutable`** : les résultats des requêtes réactives sont figés au lieu d'être copiés. C'est moins coûteux avec de nombreuses photos, et toute mutation accidentelle d'une donnée lue lève une erreur.

## Composants d'interface

Les composants sont ceux de shadcn/ui (même API, mêmes styles). Seuls `Dialog`, `AlertDialog`, `Tabs` et `DropdownMenu` sont réimplémentés sur les **éléments natifs** du navigateur (`<dialog>`, attribut `popover`, positionnement par ancre CSS, motif ARIA des onglets) plutôt que sur Radix. Voir `DECISIONS.md`, n° 13. Le tri utilise un `<select>` natif. Les suggestions de saisie utilisent `<datalist>`, et les zones de texte s'agrandissent avec leur contenu grâce à `field-sizing: content` (sans JavaScript).

En test (jsdom), `src/test/domPolyfills.ts` simule `showModal()` et l'API Popover.
