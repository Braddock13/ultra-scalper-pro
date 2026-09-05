//+------------------------------------------------------------------+
//|                                         UltraScalperPro.mq5      |
//|  ULTRA SCALPER PRO — robot live MT5, exécution OnTick (sous M1)  |
//|  Compiler dans MetaEditor, glisser sur un graphique, AutoTrading |
//+------------------------------------------------------------------+
#property copyright "ULTRA SCALPER PRO"
#property version   "1.10"
#property description "Scalper tick agressif multi-symboles. Lots 0.03, cible +55 USD sous 5000."

#include <Trade/Trade.mqh>

enum ENUM_USP_POWER
  {
   POWER_IGNITION = 0,  // Ignition
   POWER_ULTRA    = 1,  // Ultra
   POWER_OVERDRIVE= 2   // Overdrive
  };

input group "Exécution"
input double         InpLots           = 0.03;
input int            InpMagic          = 202609;
input ENUM_USP_POWER InpPower          = POWER_ULTRA;
input int            InpMaxConcurrent  = 6;
input int            InpMaxPerSymbol   = 3;
input int            InpHoldSeconds    = 28;
input double         InpMaxSpreadMult  = 1.8;
input int            InpDeviationPts   = 30;

input group "Cible session"
input double         InpAutoCloseUsd   = 55.0;
input double         InpAutoCloseUnder = 5000.0;

input group "Symboles"
input bool           InpEURUSD         = true;
input bool           InpGBPUSD         = true;
input bool           InpUSDJPY         = true;
input bool           InpXAUUSD         = true;
input bool           InpBTCUSD         = true;

CTrade trade;

string   g_symbols[];
double   g_start_equity;
datetime g_session_start;
ulong    g_last_fill_ms = 0;

#define RING 120

struct TickRing
  {
   double mid[RING];
   int    n;
   int    head;
  };

TickRing g_ring[];

int PowerCooldown()
  {
   if(InpPower == POWER_OVERDRIVE) return 180;
   if(InpPower == POWER_IGNITION)  return 900;
   return 380;
  }

int PowerBurstNeed()
  {
   if(InpPower == POWER_OVERDRIVE) return 9;
   if(InpPower == POWER_IGNITION)  return 12;
   return 11;
  }

double PowerHoldScale()
  {
   if(InpPower == POWER_OVERDRIVE) return 0.70;
   if(InpPower == POWER_IGNITION)  return 1.35;
   return 1.00;
  }

double PowerBoost()
  {
   if(InpPower == POWER_OVERDRIVE) return 0.82;
   if(InpPower == POWER_IGNITION)  return 1.20;
   return 1.00;
  }

int SlPips(const string s)
  {
   if(StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0) return 14;
   if(StringFind(s, "BTC") >= 0) return 18;
   if(StringFind(s, "GBP") >= 0) return 8;
   if(StringFind(s, "JPY") >= 0) return 8;
   return 7;
  }

int TpPips(const string s)
  {
   if(StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0) return 9;
   if(StringFind(s, "BTC") >= 0) return 12;
   return 5;
  }

int TrailPips(const string s)
  {
   if(StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0) return 5;
   if(StringFind(s, "BTC") >= 0) return 7;
   return 3;
  }

double PipSize(const string s)
  {
   if(StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0) return 0.10;
   if(StringFind(s, "BTC") >= 0) return 1.0;
   int d = (int)SymbolInfoInteger(s, SYMBOL_DIGITS);
   double pt = SymbolInfoDouble(s, SYMBOL_POINT);
   if(d == 3 || d == 5) return pt * 10.0;
   if(d == 2 || d == 4) return pt * 10.0;
   return pt;
  }

double MinAtr(const string s)
  {
   if(StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0) return 0.08;
   if(StringFind(s, "BTC") >= 0) return 4.0;
   if(StringFind(s, "JPY") >= 0) return 0.008;
   if(StringFind(s, "GBP") >= 0) return 0.00005;
   return 0.00004;
  }

void SetFilling(const string symbol)
  {
   long fm = SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((fm & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      trade.SetTypeFilling(ORDER_FILLING_IOC);
   else if((fm & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      trade.SetTypeFilling(ORDER_FILLING_FOK);
   else
      trade.SetTypeFilling(ORDER_FILLING_RETURN);
  }

void PushMid(const int idx, const double mid)
  {
   int h = g_ring[idx].head;
   g_ring[idx].mid[h] = mid;
   g_ring[idx].head = (h + 1) % RING;
   if(g_ring[idx].n < RING) g_ring[idx].n++;
  }

double RingAt(const int idx, const int back)
  {
   int n = g_ring[idx].n;
   if(n <= 0) return 0;
   int pos = g_ring[idx].head - 1 - back;
   while(pos < 0) pos += RING;
   return g_ring[idx].mid[pos % RING];
  }

double EmaOf(const int idx, const int period, const int take)
  {
   int n = MathMin(g_ring[idx].n, take);
   if(n < 2) return RingAt(idx, 0);
   double k = 2.0 / (period + 1.0);
   double e = RingAt(idx, n - 1);
   for(int i = n - 2; i >= 0; i--)
      e = RingAt(idx, i) * k + e * (1.0 - k);
   return e;
  }

double TickAtr(const int idx)
  {
   int n = MathMin(g_ring[idx].n, 41);
   if(n < 8) return 0;
   double sum = 0;
   int c = 0;
   for(int i = 1; i < n; i++)
     {
      sum += MathAbs(RingAt(idx, i - 1) - RingAt(idx, i));
      c++;
     }
   return (c > 0 ? sum / c : 0);
  }

int CountMagic()
  {
   int c = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) == InpMagic) c++;
     }
   return c;
  }

int CountSymbol(const string symbol)
  {
   int c = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(PositionGetString(POSITION_SYMBOL) == symbol) c++;
     }
   return c;
  }

void FlattenAll(const string reason)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      string sym = PositionGetString(POSITION_SYMBOL);
      SetFilling(sym);
      trade.PositionClose(ticket);
     }
   Print("USP flatten: ", reason);
   g_start_equity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_session_start = TimeCurrent();
  }

void Manage(const string symbol)
  {
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double pip = PipSize(symbol);
   double trailDist = pip * TrailPips(symbol) * PowerBoost();
   int hold = (int)MathMax(4, InpHoldSeconds * PowerHoldScale());
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;

      long type = PositionGetInteger(POSITION_TYPE);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      double open = PositionGetDouble(POSITION_PRICE_OPEN);
      datetime opened = (datetime)PositionGetInteger(POSITION_TIME);
      double px = (type == POSITION_TYPE_BUY ? bid : ask);

      bool close = false;
      if(TimeCurrent() - opened >= hold) close = true;

      if(!close && trailDist > 0)
        {
         double nsl = sl;
         if(type == POSITION_TYPE_BUY)
           {
            if(px - open > trailDist)
               nsl = MathMax(sl, px - trailDist);
           }
         else
           {
            if(open - px > trailDist)
               nsl = (sl == 0 ? px + trailDist : MathMin(sl, px + trailDist));
           }
         nsl = NormalizeDouble(nsl, digits);
         if(nsl != sl && nsl > 0)
           {
            SetFilling(symbol);
            trade.PositionModify(ticket, nsl, tp);
           }
        }

      if(close)
        {
         SetFilling(symbol);
         trade.PositionClose(ticket);
        }
     }
  }

int Detect(const int idx, const string symbol)
  {
   if(g_ring[idx].n < 28) return 0;
   int need = PowerBurstNeed();
   int up = 0, down = 0;
   double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0) tickSize = SymbolInfoDouble(symbol, SYMBOL_POINT);
   for(int i = 1; i < 18; i++)
     {
      double d = RingAt(idx, i - 1) - RingAt(idx, i);
      if(d > tickSize * 0.4) up++;
      else if(d < -tickSize * 0.4) down++;
     }
   double slope = RingAt(idx, 0) - RingAt(idx, 17);
   double atr = TickAtr(idx);
   if(atr < MinAtr(symbol)) return 0;
   double fast = EmaOf(idx, 3, 60);
   double slow = EmaOf(idx, 9, 60);
   int trend = (fast > slow ? 1 : (fast < slow ? -1 : 0));
   if(trend == 0) return 0;
   double thr = atr * (InpPower == POWER_OVERDRIVE ? 0.10 : 0.16);
   if(up >= need && trend == 1 && MathAbs(slope) > thr && slope > 0) return 1;
   if(down >= need && trend == -1 && MathAbs(slope) > thr && slope < 0) return -1;
   return 0;
  }

bool OpenDir(const string symbol, const int dir)
  {
   if(CountMagic() >= InpMaxConcurrent) return false;
   if(CountSymbol(symbol) >= InpMaxPerSymbol) return false;
   double lots = InpLots;
   if(lots < SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN))
      lots = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   if(step > 0) lots = MathFloor(lots / step) * step;
   if(lots > SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX))
      lots = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);

   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double pip = PipSize(symbol);
   double boost = PowerBoost();
   double slDist = pip * SlPips(symbol) * boost;
   double tpDist = pip * TpPips(symbol) * boost;
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   int stops = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double minDist = stops * SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(slDist < minDist) slDist = minDist;
   if(tpDist < minDist) tpDist = minDist;

   double sl, tp, px;
   if(dir > 0)
     {
      px = ask;
      sl = NormalizeDouble(px - slDist, digits);
      tp = NormalizeDouble(px + tpDist, digits);
     }
   else
     {
      px = bid;
      sl = NormalizeDouble(px + slDist, digits);
      tp = NormalizeDouble(px - tpDist, digits);
     }

   SetFilling(symbol);
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpDeviationPts);
   bool ok = (dir > 0)
               ? trade.Buy(lots, symbol, 0, sl, tp, "USP")
               : trade.Sell(lots, symbol, 0, sl, tp, "USP");
   if(ok) g_last_fill_ms = GetTickCount64();
   else Print("USP order fail ", symbol, " ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
   return ok;
  }

void CheckTarget()
  {
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(bal >= InpAutoCloseUnder && g_start_equity >= InpAutoCloseUnder) return;
   if(eq - g_start_equity >= InpAutoCloseUsd)
      FlattenAll("target +USD");
  }

string ResolveSymbol(const string raw)
  {
   if(SymbolSelect(raw, true)) return raw;
   string alts[6];
   alts[0] = raw + "m";
   alts[1] = raw + ".m";
   alts[2] = raw + "m#";
   alts[3] = raw + ".pro";
   alts[4] = (raw == "XAUUSD" ? "GOLD" : "");
   alts[5] = (raw == "BTCUSD" ? "BTCUSD.a" : "");
   for(int i = 0; i < 6; i++)
     {
      if(alts[i] == "") continue;
      if(SymbolSelect(alts[i], true)) return alts[i];
     }
   return raw;
  }

int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpDeviationPts);
   trade.SetAsyncMode(false);

   ArrayResize(g_symbols, 0);
   if(InpEURUSD) { int n = ArraySize(g_symbols); ArrayResize(g_symbols, n + 1); g_symbols[n] = "EURUSD"; }
   if(InpGBPUSD) { int n = ArraySize(g_symbols); ArrayResize(g_symbols, n + 1); g_symbols[n] = "GBPUSD"; }
   if(InpUSDJPY) { int n = ArraySize(g_symbols); ArrayResize(g_symbols, n + 1); g_symbols[n] = "USDJPY"; }
   if(InpXAUUSD)
     {
      int n = ArraySize(g_symbols);
      ArrayResize(g_symbols, n + 1);
      g_symbols[n] = "XAUUSD";
     }
   if(InpBTCUSD) { int n = ArraySize(g_symbols); ArrayResize(g_symbols, n + 1); g_symbols[n] = "BTCUSD"; }

   ArrayResize(g_ring, ArraySize(g_symbols));
   for(int i = 0; i < ArraySize(g_symbols); i++)
     {
      g_ring[i].n = 0;
      g_ring[i].head = 0;
      g_symbols[i] = ResolveSymbol(g_symbols[i]);
      if(!SymbolSelect(g_symbols[i], true))
         Print("USP: symbole introuvable chez ce courtier: ", g_symbols[i], " — vérifiez le suffixe (ex. EURUSD.m)");
     }

   g_start_equity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_session_start = TimeCurrent();
   Print("ULTRA SCALPER PRO live — lots ", InpLots, " magic ", InpMagic);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   Comment("");
  }

void OnTick()
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
     {
      Comment("ULTRA SCALPER PRO\nAutoTrading OFF — activez le bouton Algo Trading");
      return;
     }

   CheckTarget();

   ulong now = GetTickCount64();
   int cooldown = PowerCooldown();

   for(int i = 0; i < ArraySize(g_symbols); i++)
     {
      string s = g_symbols[i];
      if(!SymbolInfoInteger(s, SYMBOL_SELECT)) continue;
      if(!SymbolInfoInteger(s, SYMBOL_TRADE_MODE)) continue;

      double bid = SymbolInfoDouble(s, SYMBOL_BID);
      double ask = SymbolInfoDouble(s, SYMBOL_ASK);
      if(bid <= 0 || ask <= 0) continue;
      double mid = (bid + ask) * 0.5;
      PushMid(i, mid);

      double spread = ask - bid;
      double refSpread = SymbolInfoInteger(s, SYMBOL_SPREAD) * SymbolInfoDouble(s, SYMBOL_POINT);
      if(refSpread <= 0) refSpread = spread;

      Manage(s);

      if(now - g_last_fill_ms < (ulong)cooldown) continue;
      if(spread > refSpread * InpMaxSpreadMult && refSpread > 0) continue;

      int dir = Detect(i, s);
      if(dir != 0) OpenDir(s, dir);
     }

   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   double session = eq - g_start_equity;
   Comment(
      "ULTRA SCALPER PRO  LIVE\n",
      "Lots ", DoubleToString(InpLots, 2),
      "  tickets ", CountMagic(), "/", InpMaxConcurrent, "\n",
      "Session ", DoubleToString(session, 2), " USD   cible ", DoubleToString(InpAutoCloseUsd, 0), "\n",
      "Magic ", InpMagic
   );
  }
