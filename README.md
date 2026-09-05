# ULTRA SCALPER PRO

Robot de scalping **live** pour MetaTrader 5, plus un terminal web (réglages, backtest, répétition paper).

## Robot réel (MT5)

Le navigateur ne peut pas router d’ordres chez un courtier. L’exécuteur live est l’Expert Advisor :

[`public/robot/UltraScalperPro.mq5`](public/robot/UltraScalperPro.mq5)

1. Ouvrir **MetaTrader 5** (n’importe quel courtier) et se connecter au compte.
2. F4 → MetaEditor → ouvrir `UltraScalperPro.mq5` → Compiler.
3. Glisser l’EA sur un graphique. Activer **Algo Trading**.
4. Clic droit sur l’EA → Propriétés → **Charger** le fichier `.set` exporté depuis le terminal web (Paramètres).

Le robot tourne en **OnTick** (sous M1), lots 0.03 simultanés, modes Ignition / Ultra / Overdrive, fermeture auto **+55 USD** si le compte est sous 5 000 USD.

Si un symbole est introuvable (suffixe courtier `EURUSD.m`, `XAUUSDm`…), ouvrez le marché dans MT5 puis relancez l’EA.

## Terminal web

```bash
npm install
npm run dev
```

- **MT5** — télécharger l’EA et le `.set`
- **Paramètres** — lots, puissance, symboles, cible
- **Backtest** — replay tick du même moteur
- **Tableau** — répétition paper uniquement

## Avertissement

Robot agressif. Le trading sur marge peut liquider le compte. Testez d’abord en **démo**. Un backtest paper ne préjuge pas du live.
