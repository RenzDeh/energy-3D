# Spiekbriefje voor de pitch

## De pitch in 30 seconden

> Dit is een digitale tweeling van een windpark bij Kortrijk. De wind, het weer, de zon en de stroomprijs zijn **echte, live data**.
> Je ziet meteen hoeveel stroom het park nu maakt, hoeveel Kortrijkse gezinnen dat voedt, wat het opbrengt in euro en hoeveel CO₂ we vermijden.
> En je ziet **wanneer stroom goedkoop en groen is**, zodat gezinnen en bedrijven hun verbruik slim kunnen plannen.

**Voor wie is het nuttig?**
- **Gezinnen met een dynamisch contract**: zij betalen per uur de beursprijs. Laden ze hun auto op het goedkope uur, dan sparen ze geld (de app toont het verschil, bv. € 2,60 in plaats van € 10).
- **Windparken en energiecoöperaties** (zoals Ecopower of Beauvent): zij zien wat hun molens opbrengen in € en CO₂, en kunnen dat aan hun coöperanten tonen.
- **De stad en projectontwikkelaars**: windmolens krijgen vaak bezwaren. Deze tool maakt op een infoavond zichtbaar wat een park betekent voor Kortrijk.

---

## Wat zie je in de 3D-scène?

| Wat je ziet | Wat het betekent |
|---|---|
| Wieken die draaien, sneller of trager | De echte windsnelheid op ±100 m hoogte |
| Neus van de molen die draait | De molen richt zich naar de wind (echte windrichting) |
| Witte strepen in de lucht | De wind zelf. Achter de rotor stroomt de lucht trager, want de molen heeft er energie uit gehaald |
| Spiraal achter de wiektippen | Tipwervels: luchtwervels die de wiektippen achterlaten |
| Gloeiende kabels met lichtpulsjes | Stroom die naar Kortrijk vloeit. Sneller = meer vermogen. **Kleur = stroomprijs**: groen goedkoop, rood duur |
| Ramen in de huizen die oplichten | Hoeveel gezinnen het park nu van stroom voorziet |
| Zon, lucht, wolken, regen | Echte zonnestand voor Kortrijk en echte bewolking en neerslag |
| Kortrijk aan de horizon | The Penta (Howest), Belfort, Broeltorens, Sint-Maartenskerk en de Leie |

---

## Elk cijfer uitgelegd

Tip: zet de app op **Eenvoudig** voor het publiek en op **Expert** als er vakmensen vragen stellen. Bij elk cijfer staat een **ⓘ** met uitleg.

### Wind (paneel rechts)
- **m/s**: windsnelheid op 10 m hoogte, zoals in het weerbericht. 1 m/s = 3,6 km/u.
- **Beaufort (Bft)**: de windschaal van het weerbericht, van 0 (windstil) tot 12 (orkaan).
- **Wind op 100 m**: hoger waait het harder. De wieken zitten op ±100 m, dus díe wind bepaalt de stroomproductie.
- **Rukwinden**: korte windstoten. Ze bepalen hoe zwaar de molen belast wordt.
- **rpm**: toeren per minuut. Grote molens draaien traag (6 à 15 rpm), maar de wiektippen halen toch meer dan 250 km/u.
- **kW / MW**: vermogen, oftewel hoeveel stroom er *op dit moment* geleverd wordt. 1 MW = 1000 kW.
- **Nominaal vermogen (3 MW)**: het maximum van één molen.

### Energie (tabblad Energie)
- **MW van het park**: alle molens samen.
- **Gezinnen**: een Vlaams gezin verbruikt gemiddeld 3500 kWh per jaar, dus gemiddeld ±0,4 kW. Vermogen ÷ 0,4 kW = aantal gezinnen.
- **% van Kortrijk**: gerekend op ±35.000 gezinnen in Kortrijk.
- **MWh (megawattuur)**: een *hoeveelheid* energie. 1 MW een uur lang = 1 MWh, ongeveer het dagverbruik van 100 gezinnen.
- **Grafiek**: de verwachte productie voor de komende 24 uur, op basis van de windverwachting.

### Markt (tabblad Markt)
- **Stroomprijs (day-ahead)**: de stroombeurs EPEX legt elke dag per uur de prijs voor morgen vast.
  - 100 €/MWh = 10 cent per kWh.
  - Op je factuur betaal je meer, door nettarieven en taksen.
- **Opbrengst**: stroom × prijs van dat uur. Bv. 18 MW × 200 €/MWh = € 3.600 per uur.
- **CO₂ vermeden**:
  - Zonder windstroom zou een gascentrale bijspringen. Die stoot ±370 kg CO₂ per MWh uit.
  - "≈ X auto's per jaar": een gemiddelde auto stoot ±1,8 ton per jaar uit (15.000 km × 120 g/km).
  - In Expert staat ook de besparing tegenover de gemiddelde Belgische mix (live van Elia). Die is kleiner, omdat België veel kernenergie heeft.
- **Wanneer stroom gebruiken?** De goedkoopste en duurste blokken van 3 uur, en het blok met de meeste wind.
- **Auto laden**: een volle laadbeurt (40 kWh) op het goedkope uur tegenover het dure uur (enkel de beursprijs).
- **Negatieve prijs**: soms is er zoveel wind- en zonnestroom dat de prijs onder nul zakt. Producenten betalen dan om te leveren, en windparken worden dan meestal tijdelijk stilgezet.

---

## Het rekenmodel (voor kenners)

**Vermogen per molen** (vereenvoudigde vermogenscurve van een 3 MW-turbine):
- onder **3 m/s** (cut-in): 0
- tussen **3 en 12 m/s**: stijgt met de **derde macht** van de windsnelheid. 2× zoveel wind = 8× zoveel vermogen.
- vanaf **12 m/s** (rated): 3 MW
- boven **25 m/s** (cut-out): stormstop, de bladen gaan in vaanstand

Vermogen van het park = vermogen per molen × aantal molens × (wieklengte)². Langere wieken vangen meer wind: 10% langer geeft ±21% meer vermogen.

**Energie** = vermogen opgeteld over de tijd (per uur, trapeziumregel).
**Opbrengst** = per uur energie (MWh) × prijs (€/MWh).

**Beperkingen** (eerlijk zeggen als ernaar gevraagd wordt):
- Het is een vereenvoudigde vermogenscurve, geen exacte curve van een specifiek merk.
- Er zijn geen verliezen meegerekend (bv. zog-effect tussen molens, onderhoud, netverliezen).
- De prijs is de groothandelsprijs, niet je eindfactuur.

---

## Databronnen

| Data | Bron |
|---|---|
| Wind, temperatuur, bewolking, neerslag + 24 u verwachting | Open-Meteo (CC BY 4.0) |
| Stroomprijs België per uur (day-ahead) | EPEX Spot via Energy-Charts (CC BY 4.0) |
| CO₂-intensiteit Belgisch stroomverbruik | Elia Open Data |
| Zonnestand | SunCalc-algoritme |

Valt een bron weg, dan toont de app een schatting en zegt hij dat ook ("schatting").

---

## Demoscript (±2 minuten)

1. **Start op Eenvoudig.** Lees de zin bovenaan rechts voor: "Het waait matig uit het zuiden…".
2. **Klik op de microfoon** en zeg: *"Hoeveel energie produceren we?"* De app antwoordt hardop.
3. **Tabblad Markt**: *"Wat kost stroom nu?"* en daarna *"Wanneer is stroom goedkoop?"*. Wijs naar de groene en rode balkjes en naar de laadtip voor de auto.
4. **Tabblad Energie** → **Speel de dag af**: de dag loopt versneld, het wordt avond, de ramen gaan branden en de kabels veranderen van kleur met de prijs.
5. Zeg *"Storm"*: de molens gaan in stormstop, de productie valt weg. Zeg daarna *"Terug naar live"*.
6. Zet de app op **Expert** om te tonen dat alle technische data er ook is.

**Werkt de microfoon niet?** Klik op "Alle commando's als knoppen". Dat doet exact hetzelfde. Spraak werkt in Chrome en Edge, niet in Firefox.

---

## Vragen die je kunt verwachten

- **"Waarom vergelijk je met een gascentrale en niet met de Belgische mix?"**
  Windstroom vervangt in de praktijk de centrale die als laatste wordt bijgeschakeld, en dat is meestal gas. In Expert staat de vergelijking met de mix er ook bij.
- **"Zijn die cijfers echt?"**
  De wind, de prijzen en de CO₂-data zijn live. De productie is berekend met een vereenvoudigd model van een 3 MW-molen.
- **"Wat brengt dit op voor een gebruiker?"**
  Met een dynamisch contract kan een gezin dat zijn auto en wasmachine slim plant, een flink deel van de energiekost uitsparen. Een coöperatie krijgt een tool om haar resultaten te tonen.
- **"Wat zou je nog toevoegen?"**
  - Koppeling met een slimme laadpaal of thuisbatterij die automatisch op het goedkope uur start.
  - Een echt windpark met de echte vermogenscurve van de turbines.
  - Zonnepanelen erbij.
