# Performances

Mesures relevées le 28/09/2026 sur la V1.0.0, avec les tests Playwright en `file://` (Chromium 141, conteneur Linux sans GPU, 4 cœurs). Un poste Windows récent donne des temps du même ordre, souvent meilleurs (accélération matérielle du navigateur).

Relancer les mesures : `npm run build`, puis `npx playwright test load.spec plan.spec photos.spec report.spec` ; les résultats s'affichent dans la console (`[load]`, `[perf]`).

## Test de charge (`tests/e2e/load.spec.ts`)

Une visite réaliste et volumineuse : **60 photos de 12 Mpx** (4000 × 3000, JPEG de 3 à 6 Mo, 272 Mo au total), **2 plans PDF**, **40 repères**, **10 sections de notes**, **3 sinistres DO**, **15 coûts**.

| Mesure                               | Résultat                                  | Objectif   |
| ------------------------------------ | ----------------------------------------- | ---------- |
| Import des 60 photos                 | 24 à 26 s (≈ 0,4 s par photo)             | —          |
| Défilement de la galerie (60 photos) | ≈ 57-60 images/s                          | fluide     |
| Zoom sur un plan avec 20 repères     | ≈ 59 images/s                             | fluide     |
| **Génération du rapport — Standard** | **10,7 à 11,4 s**, fichier de **11,7 Mo** | **< 60 s** |
| Génération du rapport — Allégée      | 6,0 à 6,9 s, fichier de **2,8 Mo**        | —          |
| Estimation affichée avant génération | 14,3 Mo (Standard), 3,9 Mo (Allégée)      | bon ordre  |
| Espace de stockage utilisé           | ≈ 28 Mo pour toute la visite              | —          |
| Erreurs console / requêtes réseau    | aucune                                    | aucune     |

Lecture :

- Les photos sont réduites à l'import (2000 px, JPEG 0,82) : une visite de 60 photos occupe ≈ 28 Mo dans le navigateur, et non les 272 Mo des originaux.
- Le rapport **Standard** (photos à 1600 px) reste lisible à l'écran et à l'impression. Pour un envoi par mail, **Allégée** (photos à 1000 px) divise la taille par 4 environ.
- L'estimation affichée surestime un peu la taille réelle (≈ +30 %) : c'est voulu, pour ne jamais annoncer un fichier plus léger qu'il ne l'est.
- La génération traite les images **une par une** (bitmaps et canevas libérés au fur et à mesure) et rend la main au navigateur entre deux images : l'interface reste utilisable et la progression s'affiche (« Photos 12 / 60… »).

## Mesures ponctuelles (autres tests e2e)

| Mesure                                                      | Résultat         | Test                       |
| ----------------------------------------------------------- | ---------------- | -------------------------- |
| Rendu d'une page de PDF (4096 px) par pdf.js                | 150-190 ms       | `plan-feasibility.spec.ts` |
| Import d'une page PDF + enregistrement du plan              | 0,4-1,1 s        | `plan.spec.ts`             |
| Traitement d'une photo 12 Mpx « bruitée » (pire cas JPEG)   | ≈ 0,6 s          | `photos.spec.ts`           |
| Zoom avec 30 repères                                        | ≈ 54-58 images/s | `plan.spec.ts`             |
| Génération de `docx` (sonde minimale, chargement compris)   | ≈ 150 ms         | `docx-feasibility.spec.ts` |
| Rapport d'une visite complète (5 photos, 1 plan) — Standard | ≈ 1 s, 291 Ko    | `report.spec.ts`           |
| Rapport de la même visite — Allégée, 2 photos par page      | ≈ 0,8 s, 222 Ko  | `report.spec.ts`           |

## Taille du fichier livré

| Élément                                | Taille               |
| -------------------------------------- | -------------------- |
| `dist/index.html` (V1.0.0)             | ≈ 2,83 Mo (2 893 kB) |
| dont pdf.js (build « legacy »)         | ≈ 1,7 Mo             |
| dont `docx` (génération Word, + JSZip) | ≈ 0,43 Mo            |
| Plafond                                | 4 Mo                 |

pdf.js et `docx` sont inclus dans le fichier unique mais **évalués seulement au premier usage** (premier import de PDF, première génération de rapport) : le démarrage de l'outil n'en est pas ralenti.
