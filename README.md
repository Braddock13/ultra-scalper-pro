# ULTRA SCALPER PRO

Terminal self-hosted de scalping MT5 haute fréquence.

## Ce que c’est

- Tableau de bord, pont MT5, backtest tick, paramètres
- Lots 0.03 simultanés, timeframes sous M1 (tick / 1s / 5s / 15s / 30s)
- Mode agressif (Ignition / Ultra / Overdrive) — pas un robot 1–2 %
- Auto-close +55 USD de session si le compte est sous 5 000 USD
- Backtest HF : le même moteur, rejoué en dizaines de milliers de ticks

Sans pont local, l’exécution tourne en paper ultra-fidèle. Les identifiants MT5 restent dans le navigateur.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir le terminal, page **MT5** : login numérique, mot de passe, serveur du courtier. Puis **Armer** → **Démarrer**. **Backtest** pour un replay haute fréquence.

## Avertissement

Robot agressif. Le trading sur marge peut liquider le compte. Un backtest ou un paper trade ne préjuge pas d’un résultat live.
