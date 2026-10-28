# energy-renz

## Reflectie

Eerst bouwde ik zonder AI enkele basisvormen zoals een cilinder, OrbitControls en de kop van de molen. Dat ging traag, maar ik begreep de code wel. Met AI kwam er op twee dagen een volledige app bij met API-integraties zoals live weer, stroomprijzen, spraak, een 3D-stadje en een paneel om stroomverbruik te analyseren. 

AI deed soms teveel of net te weinig waardoor ik natuurlijk moest bijsturen. De berekeningen gebeurden telkens door AI, maar bijvoorbeeld bij autoladen met een stopcontact duurt dit langer dan 24 uur. Daar moest ik bijsturen zodat de grafiek, indien stopcontact geselecteerd was, wel duidelijk meer dan 24 uur moest tonen. Een build die faalde door de tsconfig, Prettier die niet wou samenwerken met de linter,... waren foutjes die ik dan weer zelf kon/moest oplossen.

De grootste vereenvoudiging met behulp van AI was naar mijn mening het ontwerp realistisch maken en uitbreiden, data- en voice integraties toevoegen en natuurlijk sneller werken. Ik vond het al een enorm verschil door eerst en vooral zelf eens door de documentatie te lopen en toch de basis onder de knie te krijgen. Het voelde al heel wat minder aan als 'vibe-coden'.

## AI-verantwoording (samengevat aan de hand van AI)

**Tool:** Claude Code (desktop-app, Claude Opus). De AI-code staat op de branch `AI-version`, de versie zonder AI op `main`.

### Fase 2

| Prompt | Wat de AI deed | Wat ik aanpaste |
|---|---|---|
| Opdracht fase 2 + *"Doe livedata, die zit er al in. Maak nu een mooie windmolen met windeffects, verbeter alles."* | Live weer (Open-Meteo), zonnestand, gedetailleerde windmolen met windeffecten, wolken, regen, bomen | Live data gekozen in plaats van een 3D-scan |
| *"Kun je de Penta van Howest hier ergens bij bouwen?"* | Gestileerd Kortrijk met Penta, Belfort en Leie | Later teruggedraaid naar een generiek stadje |

### Fase 3

| Prompt | Wat de AI deed | Wat ik aanpaste |
|---|---|---|
| Opdracht fase 3 + *"Wat zullen wij doen?"* | Spraakbesturing, windvermogenmodel, dag versneld afspelen, sliders | Zelf wind als energiegrootheid gekozen |
| *"Ja, bouw de energieprijs- en opbrengstmodule."* | Beursprijzen, CO₂, opbrengst in euro, goedkoopste momenten | Zelf gekozen welke module |
| *"Wat hebben de mensen nu aan mijn app?"* | Analyse van mogelijke gebruikers | Besloten om me op gewone burgers te richten |
| *"Wisselen van stad via een search... niet specifiek Kortrijk... toon wanneer energie het goedkoopst is."* | Stad zoeken, planner voor toestellen, generiek stadje | Nieuwe branch gemaakt |
| *"Maak de infoschermen simpeler... voor gewone burgers."* | Nieuwe lichte interface met tabbladen | Doelgroep bepaald |
| *"Hoe kunnen we dit nog verbeteren?"* → *"Doe 2, 3 en 12. 1 is niet nodig."* | Gezinsprijs, auto laden in km, tsconfig hersteld | Zelf voorstellen gekozen |
| *"Ik heb in vele ts-files fouten"* → *"Yes, auto-fix"* | ESLint-fouten opgelost, Prettier uitgezet | — |
| *"Het moet nog boven de 24 uur kunnen."* | Planner kijkt 48 uur vooruit | Fout zelf gevonden bij het testen |
| *"Vervang gewoon enkele goedkope toestellen door wat duurdere."* | Thuisbatterij, warmtepomp en sauna toegevoegd | Grote verbruikers gekozen omdat die het verschil maken |

### Controle

Ik liet de app na elke wijziging bouwen en testte zelf in de browser. Ik liet de code en databronnen uitleggen zodat ik ze kan begrijpen en verdedigen. Het windpark is een simulatie met echte winddata, ook de energieprijzen komen rechtstreeks uit de huidige beursdata. De gezinsprijs en jaarbesparing zijn simpelweg berekeningen / schattingen op basis van gemiddelden uit bronnen die AI zelf vond.

## Features

- [Tres.js](https://tresjs.org) and latest [Three.js](https://threejs.org)
- `@tresjs/cientos` package pre-installed 📦
- `@tresjs/leches` GUI controls for debugging 🍰
- Shader support (glsl) with [`vite-plugin-glsl`](https://github.com/UstymUkhman/vite-plugin-glsl) 🎨
- TypeScript support 🦄
- ESLint configuration 🔧

## Getting Started

### Install dependencies

De app staat in de map `energy-renz`; voer alle commando's daar uit.

```bash
cd energy-renz
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

### Build

Build the application for production:

```bash
npm run build
```

### Preview

Locally preview production build:

```bash
npm run preview
```

### Lint

Run ESLint:

```bash
npm run lint
```

Fix ESLint issues:

```bash
npm run lint:fix
```

## Learn More

- [TresJS Documentation](https://tresjs.org)
- [Three.js Documentation](https://threejs.org/docs/)
- [Vue.js Documentation](https://vuejs.org/)
