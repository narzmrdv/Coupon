import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wp, hp, fontSize } from '@/shared/lib/responsive';
import { useLanguage } from '@/shared/lib/hooks';
import { bonusApi } from '@/entities/bonus/api/bonusApi';
import { socketService } from '@/shared/lib/socket/socketService';
import { notificationsApi } from '@/shared/api/notificationsApi';

const NICK_KEY = '@profile_nickname';
const AVATAR_URL_KEY = '@profile_avatar_url';

// ─── HTML builder ─────────────────────────────────────────────────────────────
//  Server-driven multiplayer mode.
//  WebView sends: window.ReactNativeWebView.postMessage(JSON.stringify({type,…}))
//  React Native injects: onServerState(state) | showError(msg)
// ──────────────────────────────────────────────────────────────────────────────
function buildHtml(nick: string, balance: number, lang: string, avatarUrl: string | null): string {
  const betLabel   = lang === 'en' ? 'Bet'         : lang === 'uk' ? 'Ставити'  : 'Ставить';
  const panelTitle = lang === 'en' ? 'Place a Bet' : 'Сделать ставку';
  const balLabel   = lang === 'en' ? 'Your TWA balance' : 'Ваш баланс TWA';
  const insuf      = lang === 'en' ? 'Insufficient TWA'
                   : lang === 'uk' ? 'Недостатньо TWA' : 'Недостаточно TWA';
  const connectMsg = lang === 'en' ? 'Connecting…' : 'Подключение…';
  const waitMsg    = lang === 'en' ? 'Waiting for bets…' : 'Ожидание ставок…';
  const needMore   = lang === 'en' ? 'Need 1 more player' : 'Нужен ещё 1 игрок';
  const maxBetMsg  = lang === 'en' ? 'Max 10 TWA per bet — place another bet to add more'
                   : lang === 'uk' ? 'Максимум 10 TWA за одну ставку — можна поставити ще раз'
                   : 'Максимум 10 TWA за одну ставку — можно поставить ещё раз';
  const roundHint  = lang === 'en'
    ? 'Round: 60 sec. Timer starts when ≥2 bets placed. Win chance = share of the pot.'
    : 'Раунд: 60 сек. Таймер стартует при минимум 2 ставках. Шанс = доля в банке.';
  const notifyCta     = lang === 'en' ? 'Call to game'
                       : lang === 'uk' ? 'Запросити у гру' : 'Позвать в игру';
  const notifySending = lang === 'en' ? 'Sending…' : lang === 'uk' ? 'Надсилання…' : 'Отправка…';
  const notifySent    = lang === 'en' ? 'Sent'      : lang === 'uk' ? 'Надіслано'   : 'Отправлено';

  const jsNick   = JSON.stringify(nick);
  const jsAvatar = JSON.stringify(avatarUrl || null);
  const jsInsuf  = JSON.stringify(insuf);
  const jsMaxBet = JSON.stringify(maxBetMsg);
  const jsWait   = JSON.stringify(waitMsg);
  const jsNeed   = JSON.stringify(needMore);
  const jsBal    = String(Number(balance) || 0);
  const jsNotifyCta     = JSON.stringify(notifyCta);
  const jsNotifySending = JSON.stringify(notifySending);
  const jsNotifySent    = JSON.stringify(notifySent);

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="ru"><head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">\n' +
    '<style>\n' +
    ':root{--bg:#f2f7fc;--panel:#fff;--panel2:#f0f7fd;--ring-border:#dcecf9;' +
    '--gold-1:#55c4f6;--gold-2:#25a6ea;--brown-1:#9fc4e0;--brown-2:#6da4cd;' +
    '--green:#22ade8;--text:#1e2b3d;--muted:#8296ad}\n' +
    '*{box-sizing:border-box;margin:0;padding:0}\n' +
    'html,body{width:100%;overflow-x:hidden}\n' +
    'body{background:linear-gradient(180deg,#fafcff 0%,var(--bg) 100%);\n' +
    'font-family:-apple-system,system-ui,sans-serif;color:var(--text);\n' +
    'display:flex;flex-direction:column;align-items:center;padding:16px 12px 80px;gap:20px}\n' +

    // Balance card
    '.balance-card{width:100%;background:linear-gradient(90deg,#38BDF8,#0EA5E9);\n' +
    'border-radius:16px;padding:14px 20px;\n' +
    'display:flex;justify-content:space-between;align-items:center;\n' +
    'box-shadow:0 4px 16px rgba(14,165,233,.3)}\n' +
    '.balance-card .lbl{font-size:13px;font-weight:600;color:rgba(255,255,255,.85)}\n' +
    '.balance-card .val{font-size:18px;font-weight:800;color:#fff}\n' +

    // Connection overlay
    '.conn-overlay{position:fixed;inset:0;background:rgba(242,247,252,.92);\n' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;\n' +
    'gap:14px;z-index:100;transition:opacity .3s}\n' +
    '.conn-overlay.hidden{opacity:0;pointer-events:none}\n' +
    '.conn-spinner{width:40px;height:40px;border:3px solid #BAE6FD;\n' +
    'border-top-color:#0EA5E9;border-radius:50%;animation:spin .8s linear infinite}\n' +
    '@keyframes spin{to{transform:rotate(360deg)}}\n' +
    '.conn-text{font-size:15px;font-weight:600;color:#0EA5E9}\n' +

    // Wheel area
    '.wheel-area{position:relative;display:flex;align-items:center;justify-content:center}\n' +
    '.wheel-wrap{position:relative;width:min(340px,92vw);height:min(340px,92vw);\n' +
    'display:flex;align-items:center;justify-content:center}\n' +
    '.pointer-top,.pointer-bottom{position:absolute;left:50%;transform:translateX(-50%);\n' +
    'width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;\n' +
    'z-index:6;pointer-events:none}\n' +
    '.pointer-top{top:4px;border-top:14px solid #1a3fc4}\n' +
    '.pointer-bottom{top:52px;border-bottom:14px solid #1a3fc4;opacity:.9}\n' +
    'canvas#wheel{width:min(340px,92vw);height:min(340px,92vw);display:block}\n' +
    '.avatars{position:absolute;inset:0;pointer-events:none;z-index:4}\n' +
    '.seg-avatar{position:absolute;top:0;left:0;width:34px;height:38px;\n' +
    'display:flex;align-items:center;justify-content:center;will-change:transform}\n' +
    '.seg-avatar .hex{width:34px;height:38px;position:relative;\n' +
    'clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);\n' +
    'display:flex;align-items:center;justify-content:center;\n' +
    'font-size:15px;font-weight:700;box-shadow:0 3px 10px rgba(37,166,234,.24)}\n' +
    // Player photo when available, falls back to the color+initial hex.
    '.hex-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}\n' +
    '.hex-letter{display:flex;align-items:center;justify-content:center;width:100%;height:100%}\n' +

    // Hub
    '.hub{position:absolute;width:min(210px,56vw);height:min(210px,56vw);border-radius:50%;\n' +
    'background:radial-gradient(50% 50%,#fff 0%,#eef7fd 100%);\n' +
    'border:1px solid var(--ring-border);box-shadow:inset 0 2px 10px rgba(37,166,234,.08);\n' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;\n' +
    'gap:8px;z-index:3;text-transform:uppercase;overflow:hidden}\n' +
    '.hub .mode{font-size:13px;font-weight:700;letter-spacing:.08em;color:var(--gold-2)}\n' +
    '.hub .pot{display:flex;align-items:center;gap:6px;font-size:30px;font-weight:600;color:var(--gold-2)}\n' +
    '.hub .pot .twa{font-size:20px;font-weight:800;color:#1a3fc4}\n' +
    '.hub .bets{font-size:12px;font-weight:500;color:var(--brown-1)}\n' +
    '.hub .timer{font-size:24px;font-weight:600;color:var(--green);\n' +
    'font-variant-numeric:tabular-nums;min-height:30px}\n' +
    '.hub .timer.waiting{font-size:12px;color:#93b3cd;text-transform:none;letter-spacing:.03em}\n' +
    '.hub-default{display:flex;flex-direction:column;align-items:center;justify-content:center;\n' +
    'gap:8px;position:relative;z-index:2}\n' +
    '.hub-winner{display:none;flex-direction:column;align-items:center;justify-content:center;\n' +
    'gap:10px;position:relative;z-index:2;text-transform:none}\n' +
    '.hub.show-winner .hub-default{display:none}\n' +
    '.hub.show-winner .hub-winner{display:flex;animation:winnerPop .45s cubic-bezier(.2,1.6,.4,1)}\n' +
    '@keyframes winnerPop{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}\n' +
    '.winner-label{font-size:16px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;\n' +
    'color:var(--green);text-shadow:0 0 14px rgba(34,173,232,.35)}\n' +
    '.winner-avatar{position:relative;display:flex;flex-direction:column;align-items:center}\n' +
    '.winner-avatar .hex.big{width:58px;height:64px;position:relative;overflow:hidden;\n' +
    'clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);\n' +
    'display:flex;align-items:center;justify-content:center;\n' +
    'font-size:26px;font-weight:800;\n' +
    'background:linear-gradient(160deg,#e9f6fe,#c2e5fa);\n' +
    'box-shadow:0 4px 18px rgba(34,173,232,.32);\n' +
    'animation:hexGlow 1.4s ease-in-out infinite alternate}\n' +
    '@keyframes hexGlow{from{filter:brightness(1)}to{filter:brightness(1.08)}}\n' +
    '.winner-badge{margin-top:-12px;background:#1a3fc4;color:#fff;\n' +
    'font-size:12px;font-weight:800;border-radius:7px;padding:1px 9px;\n' +
    'box-shadow:0 3px 8px rgba(26,63,196,.35);position:relative;z-index:3}\n' +
    '.winner-nick{font-size:17px;font-weight:800;color:var(--text);\n' +
    'max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}\n' +

    // Coins
    '.coins-layer{position:absolute;inset:0;z-index:1;pointer-events:none}\n' +
    '.coins-layer .fly-coin{position:absolute;width:var(--sz);height:var(--sz);border-radius:50%;\n' +
    'background:radial-gradient(circle at 35% 35%,#82d4f9,#1897dd 70%);\n' +
    'border:2px solid #45bbf2;color:#fff;\n' +
    'display:flex;align-items:center;justify-content:center;\n' +
    'font-size:calc(var(--sz)*.5);font-weight:800;\n' +
    'opacity:0;animation:coinFloat var(--dur) ease-in-out var(--delay) infinite;\n' +
    'box-shadow:0 4px 12px rgba(34,173,232,.32)}\n' +
    '@keyframes coinFloat{\n' +
    '0%{transform:translateY(14px) scale(.6) rotate(-8deg);opacity:0}\n' +
    '20%{opacity:.95}\n' +
    '50%{transform:translateY(-8px) scale(1) rotate(6deg);opacity:1}\n' +
    '80%{opacity:.85}\n' +
    '100%{transform:translateY(-26px) scale(.75) rotate(-4deg);opacity:0}}\n' +

    // Panel
    '.panel{background:var(--panel);border:1px solid var(--ring-border);\n' +
    'border-radius:22px;padding:24px;width:100%;\n' +
    'display:flex;flex-direction:column;gap:16px;\n' +
    'box-shadow:0 8px 30px rgba(37,166,234,.1)}\n' +
    '.panel h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}\n' +
    '.notify-btn{background:#EFF6FF;border-radius:10px;padding:8px 14px;align-self:flex-start;\n' +
    'font-size:14px;font-weight:700;color:#0EA5E9;border:1px solid #BAE6FD;\n' +
    'cursor:pointer;-webkit-tap-highlight-color:transparent}\n' +
    '.notify-btn:disabled{color:#94A3B8;background:#F1F5F9;border-color:#E2E8F0;cursor:default}\n' +
    '.notify-btn.sent{color:#16A34A;background:#DCFCE7;border-color:#BBF7D0}\n' +
    '.bet-row{display:flex;gap:8px;align-items:stretch}\n' +
    '.bet-prefix{display:flex;align-items:center;\n' +
    'background:var(--panel2);border:1px solid var(--ring-border);\n' +
    'border-radius:10px 0 0 10px;border-right:none;\n' +
    'padding:0 10px;font-size:12px;font-weight:700;color:var(--muted)}\n' +
    '.bet-row input{flex:1;min-width:0;background:var(--panel2);\n' +
    'border:1px solid var(--ring-border);border-radius:0 10px 10px 0;\n' +
    'padding:12px;color:var(--text);font-size:16px;outline:none}\n' +
    '.bet-row input:focus{border-color:var(--gold-2)}\n' +
    'button.bet-btn{background:linear-gradient(180deg,#2a55d6,#1a3fc4);\n' +
    'border:0;border-radius:10px;padding:12px 20px;\n' +
    'font-weight:700;font-size:15px;color:#fff;cursor:pointer;\n' +
    'white-space:nowrap;box-shadow:0 3px 10px rgba(26,63,196,.3);\n' +
    '-webkit-tap-highlight-color:transparent}\n' +
    'button.bet-btn:active{opacity:.85}\n' +
    'button.bet-btn:disabled{opacity:.4;cursor:not-allowed}\n' +
    '.error-msg{font-size:12px;color:#EF4444;display:none;margin-top:-8px}\n' +
    '.error-msg.show{display:block}\n' +
    '.players-list{display:flex;flex-direction:column;gap:8px}\n' +
    '.player-item{display:flex;align-items:center;gap:10px;\n' +
    'background:var(--panel2);border-radius:10px;padding:8px 12px;font-size:14px}\n' +
    '.player-item .dot{width:12px;height:12px;border-radius:3px;flex-shrink:0}\n' +
    '.player-item .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n' +
    '.player-item .amount{font-weight:700;color:var(--gold-2)}\n' +
    '.player-item .chance{font-size:12px;color:var(--muted);min-width:52px;text-align:right}\n' +
    '.hint{font-size:12px;color:#87a2ba;line-height:1.5}\n' +
    '</style></head><body>\n' +

    // Connection overlay
    '<div class="conn-overlay" id="connOverlay">' +
    '<div class="conn-spinner"></div>' +
    '<div class="conn-text">' + connectMsg + '</div>' +
    '</div>\n' +

    // Balance card
    '<div class="balance-card">' +
    '<span class="lbl">' + balLabel + '</span>' +
    '<span class="val" id="balanceDisplay">✈ ' + jsBal + ' TWA</span>' +
    '</div>\n' +

    // Wheel
    '<div class="wheel-area">\n' +
    '<div class="wheel-wrap">\n' +
    '<div class="pointer-top"></div>\n' +
    '<div class="pointer-bottom"></div>\n' +
    '<canvas id="wheel" width="680" height="680"></canvas>\n' +
    '<div class="avatars" id="avatars"></div>\n' +
    '<div class="hub" id="hub">\n' +
    '<div class="coins-layer" id="coinsLayer"></div>\n' +
    '<div class="hub-default" id="hubDefault">\n' +
    '<div class="mode">Minute</div>\n' +
    '<div class="pot"><span id="pot">5.00</span><span class="twa">TwA</span></div>\n' +
    '<div class="bets" id="betsCount">0 СТАВОК</div>\n' +
    '<div class="timer waiting" id="timer">Ожидание ставок…</div>\n' +
    '</div>\n' +
    '<div class="hub-winner" id="hubWinner">\n' +
    '<div class="winner-label">Winner!</div>\n' +
    '<div class="winner-avatar">\n' +
    '<div class="hex big" id="winnerHex">' +
    '<img class="hex-img" id="winnerHexImg" style="display:none">' +
    '<span class="hex-letter" id="winnerHexLetter">?</span>' +
    '</div>\n' +
    '<div class="winner-badge" id="winnerBadge">0</div>\n' +
    '</div>\n' +
    '<div class="winner-nick" id="winnerNick"></div>\n' +
    '</div>\n' +
    '</div>\n' +
    '</div>\n' +
    '</div>\n' +

    // Bet panel
    '<div class="panel">\n' +
    '<h2>' + panelTitle + '</h2>\n' +
    '<button class="notify-btn" id="notifyBtn" disabled></button>\n' +
    '<div class="bet-row">\n' +
    '<span class="bet-prefix">TWA</span>\n' +
    '<input id="amountInput" type="number" placeholder="0.00" min="0.01" max="10" step="0.01">\n' +
    '<button class="bet-btn" id="betBtn">' + betLabel + '</button>\n' +
    '</div>\n' +
    '<div class="error-msg" id="errorMsg"></div>\n' +
    '<div class="players-list" id="playersList"></div>\n' +
    '<p class="hint">' + roundHint + '</p>\n' +
    '</div>\n' +

    // ── GAME SCRIPT ──────────────────────────────────────────────────────────
    '<script>\n' +
    '(function(){\n' +
    '  var NICK    = ' + jsNick + ';\n' +
    '  var MY_AVATAR_URL = ' + jsAvatar + ';\n' +
    '  var INSUF   = ' + jsInsuf + ';\n' +
    '  var MAXBET  = ' + jsMaxBet + ';\n' +
    '  var WAIT    = ' + jsWait + ';\n' +
    '  var NEED    = ' + jsNeed + ';\n' +
    '  var NOTIFY_CTA     = ' + jsNotifyCta + ';\n' +
    '  var NOTIFY_SENDING = ' + jsNotifySending + ';\n' +
    '  var NOTIFY_SENT    = ' + jsNotifySent + ';\n' +
    '  var MIN_BETS = 2;\n' +
    '  var MAX_SINGLE_BET = 10;\n' +
    '  var PRIZE   = 5.00;\n' +
    '  var COLORS  = ["#35b3f0","#4ecb71","#f2b234","#ef6b6b","#9b6ef2","#2fc9b4","#f28c4e","#e061b8","#a4c93a","#5b8ff2"];\n' +
    '  var currentBalance = ' + jsBal + ';\n' +

    '  var canvas      = document.getElementById("wheel");\n' +
    '  var ctx         = canvas.getContext("2d");\n' +
    '  var avatarsEl   = document.getElementById("avatars");\n' +
    '  var potEl       = document.getElementById("pot");\n' +
    '  var betsCountEl = document.getElementById("betsCount");\n' +
    '  var timerEl     = document.getElementById("timer");\n' +
    '  var hubEl       = document.getElementById("hub");\n' +
    '  var coinsEl     = document.getElementById("coinsLayer");\n' +
    '  var winHexEl    = document.getElementById("winnerHex");\n' +
    '  var winHexImgEl = document.getElementById("winnerHexImg");\n' +
    '  var winHexLetterEl = document.getElementById("winnerHexLetter");\n' +
    '  var winBadgeEl  = document.getElementById("winnerBadge");\n' +
    '  var winNickEl   = document.getElementById("winnerNick");\n' +
    '  var listEl      = document.getElementById("playersList");\n' +
    '  var betBtn      = document.getElementById("betBtn");\n' +
    '  var amtInput    = document.getElementById("amountInput");\n' +
    '  var errEl       = document.getElementById("errorMsg");\n' +
    '  var balEl       = document.getElementById("balanceDisplay");\n' +
    '  var connEl      = document.getElementById("connOverlay");\n' +
    '  var notifyBtn   = document.getElementById("notifyBtn");\n' +

    // ── Notify button — a shared (same for everyone) 5-min cooldown plus a
    // lifetime send cap, not tied to the betting round. React Native pushes
    // {hasBet,busy,cooldownUntil,sendCount,maxSends} in via
    // window.updateNotifyState; this file just renders whatever it's given
    // and ticks the cooldown display locally between pushes.
    '  var notifyHasBet = false, notifyBusy = false;\n' +
    '  var notifyCooldownUntil = null, notifySendCount = 0, notifyMaxSends = 3;\n' +
    '  function renderNotifyBtn(){\n' +
    '    if(!notifyBtn) return;\n' +
    '    if(notifySendCount >= notifyMaxSends){\n' +
    '      notifyBtn.textContent = "✓ " + NOTIFY_SENT;\n' +
    '      notifyBtn.disabled = true; notifyBtn.classList.add("sent");\n' +
    '      return;\n' +
    '    }\n' +
    '    if(notifyBusy){\n' +
    '      notifyBtn.textContent = "📣 " + NOTIFY_SENDING;\n' +
    '      notifyBtn.disabled = true; notifyBtn.classList.remove("sent");\n' +
    '      return;\n' +
    '    }\n' +
    '    var leftMs = notifyCooldownUntil ? notifyCooldownUntil - Date.now() : 0;\n' +
    '    if(leftMs > 0){\n' +
    '      var leftSec = Math.ceil(leftMs / 1000);\n' +
    '      var m = Math.floor(leftSec / 60), sec = leftSec % 60;\n' +
    '      notifyBtn.textContent = "⏱ " + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");\n' +
    '      notifyBtn.disabled = true; notifyBtn.classList.remove("sent");\n' +
    '      return;\n' +
    '    }\n' +
    '    notifyBtn.textContent = "📣 " + NOTIFY_CTA;\n' +
    '    notifyBtn.disabled = !notifyHasBet; notifyBtn.classList.remove("sent");\n' +
    '  }\n' +
    '  function updateNotifyState(s){\n' +
    '    s = s || {};\n' +
    '    notifyHasBet = !!s.hasBet;\n' +
    '    notifyBusy = !!s.busy;\n' +
    '    notifyCooldownUntil = s.cooldownUntil || null;\n' +
    '    notifySendCount = s.sendCount || 0;\n' +
    '    notifyMaxSends = s.maxSends || 3;\n' +
    '    renderNotifyBtn();\n' +
    '  }\n' +
    '  updateNotifyState({hasBet:false, sent:false, busy:false, cooldownUntil:null, sendCount:0, maxSends:3});\n' +
    '  setInterval(renderNotifyBtn, 1000);\n' +
    '  if(notifyBtn){\n' +
    '    notifyBtn.addEventListener("click", function(){\n' +
    '      if(notifyBtn.disabled) return;\n' +
    '      if(window.ReactNativeWebView){\n' +
    '        window.ReactNativeWebView.postMessage(JSON.stringify({type:"notify"}));\n' +
    '      }\n' +
    '    });\n' +
    '  }\n' +

    // Game state — driven by server
    '  var players  = [];\n' +
    '  var phase    = "waiting";\n' + // waiting/betting/spinning/finished
    '  var deadline = null;\n' +
    '  var rotation = 0;\n' +
    '  var animating = false;\n' +

    // ── Helpers ──
    '  function showError(m){\n' +
    '    errEl.textContent=m;errEl.classList.add("show");\n' +
    '    setTimeout(function(){errEl.classList.remove("show");},2500);\n' +
    '  }\n' +

    '  function total(){return players.reduce(function(s,p){return s+p.amount;},0);}\n' +

    // ── Server state handler ─────────────────────────────────────────────────
    // Called by React Native via injectJavaScript
    '  function onServerState(state){\n' +
    '    connEl.classList.add("hidden");\n' +  // Hide "Connecting" once we get state

    // Update balance
    '    var newBal = state.myBalance !== undefined ? state.myBalance : state.balance;\n' +
    '    if(newBal !== undefined && newBal !== null){\n' +
    '      currentBalance = Number(newBal);\n' +
    '      balEl.textContent = "✈ " + currentBalance.toFixed(2) + " TWA";\n' +
    '    }\n' +

    // Update pot
    '    if(state.pot !== undefined) PRIZE = Number(state.pot);\n' +

    // Map server players to local format
    '    var newPlayers = (state.players || []).map(function(p, i){\n' +
    '      var pname = String(p.nick || p.name || "?");\n' +
    '      var pAvatar = p.avatarUrl || null;\n' +
    '      if(!pAvatar && MY_AVATAR_URL && pname.toLowerCase() === NICK.toLowerCase()) pAvatar = MY_AVATAR_URL;\n' +
    '      return {name: pname, amount: Number(p.amount) || 0,\n' +
    '        color: p.color || COLORS[i % COLORS.length], avatarUrl: pAvatar};\n' +
    '    });\n' +

    '    var prevPhase = phase;\n' +

    // Handle phase transitions
    '    if(state.phase === "spinning" && prevPhase !== "spinning" && !animating){\n' +
    '      players = newPlayers;\n' +
    '      phase = "spinning";\n' +
    '      var w = state.winner;\n' +
    '      var winnerName = w ? String(w.nick || w.name || "") : "";\n' +
    '      var winPlayer = players.find(function(p){\n' +
    '        return p.name.toLowerCase() === winnerName.toLowerCase();\n' +
    '      }) || players[players.length - 1];\n' +
    '      if(winPlayer) startSpin(winPlayer);\n' +

    '    } else if(state.phase === "betting"){\n' +
    '      if(animating) return;\n' +
    '      players = newPlayers;\n' +
    '      phase = "betting";\n' +
    '      deadline = state.deadline ? Number(state.deadline) : null;\n' +
    '      hubEl.classList.remove("show-winner");\n' +
    '      coinsEl.innerHTML = "";\n' +
    '      rotation = 0;\n' +
    '      betBtn.disabled = false;\n' +
    '      render();\n' +

    '    } else if(state.phase === "finished"){\n' +
    '      if(animating) return;\n' +
    '      phase = "finished";\n' +
    '      players = newPlayers;\n' +
    '      var fw = state.winner;\n' +
    '      if(fw){\n' +
    '        var fwName = String(fw.nick || fw.name || "?");\n' +
    '        var fwAvatar = fw.avatarUrl || null;\n' +
    '        if(!fwAvatar && MY_AVATAR_URL && fwName.toLowerCase() === NICK.toLowerCase()) fwAvatar = MY_AVATAR_URL;\n' +
    '        var fwPlayer = players.find(function(p){\n' +
    '          return p.name.toLowerCase() === fwName.toLowerCase();\n' +
    '        }) || {name: fwName, amount: fw.amount || 0, color: fw.color || COLORS[0], avatarUrl: fwAvatar};\n' +
    '        showWinner(fwPlayer);\n' +
    '      }\n' +

    '    } else {\n' +
    '      if(!animating){\n' +
    '        players = newPlayers;\n' +
    '        deadline = state.deadline ? Number(state.deadline) : null;\n' +
    '        render();\n' +
    '      }\n' +
    '    }\n' +
    '  }\n' +

    // ── placeBet — sends to React Native ───────────────────────────────────
    '  function placeBet(amount){\n' +
    '    if(phase !== "betting") return;\n' +
    '    amount = Math.round(amount * 100) / 100;\n' +
    '    if(!(amount > 0)) return;\n' +
    '    if(amount > MAX_SINGLE_BET){ showError(MAXBET); return; }\n' +
    '    if(amount > currentBalance){ showError(INSUF); return; }\n' +
    '    betBtn.disabled = true;\n' +
    '    if(window.ReactNativeWebView){\n' +
    '      window.ReactNativeWebView.postMessage(JSON.stringify({type:"bet",amount:amount}));\n' +
    '    }\n' +
    '    amtInput.value = "";\n' +
    '  }\n' +

    // ── startSpin — takes a winner from server ──────────────────────────────
    '  function startSpin(winnerPlayer){\n' +
    '    if(animating) return;\n' +
    '    animating = true;\n' +
    '    betBtn.disabled = true;\n' +
    '    var segs = segments();\n' +
    '    var seg = segs.find(function(s){\n' +
    '      return s.player.name.toLowerCase() === winnerPlayer.name.toLowerCase();\n' +
    '    });\n' +
    '    if(!seg && segs.length) seg = segs[segs.length - 1];\n' +
    '    if(!seg){ animating = false; return; }\n' +
    '    var pad = (seg.end - seg.start) * 0.15;\n' +
    '    var target = seg.start + pad + Math.random() * ((seg.end - seg.start) - pad * 2);\n' +
    '    var spins = 8;\n' +
    '    var current = rotation % (Math.PI * 2);\n' +
    '    var fin = -target;\n' +
    '    while(fin < current) fin += Math.PI * 2;\n' +
    '    fin += spins * Math.PI * 2;\n' +
    '    var startRot = rotation, delta = fin - startRot, duration = 9000, t0 = performance.now();\n' +
    '    var ACCEL = 0.18, POW = 4.5;\n' +
    '    var K = POW / (2 * ACCEL * (1 - ACCEL) + POW * ACCEL * ACCEL);\n' +
    '    function ease(t){\n' +
    '      if(t <= ACCEL) return K * t * t;\n' +
    '      var sA = K * ACCEL * ACCEL;\n' +
    '      return 1 - (1 - sA) * Math.pow((1 - t) / (1 - ACCEL), POW);\n' +
    '    }\n' +
    '    timerEl.textContent = ""; timerEl.classList.remove("waiting");\n' +
    '    function frame(now){\n' +
    '      var t = Math.min((now - t0) / duration, 1);\n' +
    '      rotation = startRot + delta * ease(t);\n' +
    '      drawWheel(); positionAvatars();\n' +
    '      if(t < 1){ requestAnimationFrame(frame); }\n' +
    '      else{\n' +
    '        animating = false;\n' +
    '        phase = "finished";\n' +
    '        showWinner(winnerPlayer);\n' +
    '      }\n' +
    '    }\n' +
    '    requestAnimationFrame(frame);\n' +
    '  }\n' +

    // ── showWinner ──────────────────────────────────────────────────────────
    '  function showWinner(w){\n' +
    '    if(w.avatarUrl){\n' +
    '      winHexImgEl.src = w.avatarUrl;\n' +
    '      winHexImgEl.style.display = "block";\n' +
    '      winHexLetterEl.style.display = "none";\n' +
    '    } else {\n' +
    '      winHexImgEl.style.display = "none";\n' +
    '      winHexLetterEl.style.display = "flex";\n' +
    '      winHexLetterEl.textContent = w.name[0].toUpperCase();\n' +
    '      winHexEl.style.color = w.color;\n' +
    '    }\n' +
    '    winBadgeEl.textContent = PRIZE.toFixed(2);\n' +
    '    winNickEl.textContent = w.name;\n' +
    '    spawnCoins(12);\n' +
    '    hubEl.classList.add("show-winner");\n' +
    '  }\n' +

    // ── spawnCoins ──────────────────────────────────────────────────────────
    '  function spawnCoins(count){\n' +
    '    coinsEl.innerHTML = "";\n' +
    '    for(var i = 0; i < count; i++){\n' +
    '      var c = document.createElement("div");\n' +
    '      c.className = "fly-coin"; c.textContent = "S";\n' +
    '      var size = 14 + Math.random() * 14;\n' +
    '      c.style.setProperty("--sz", size.toFixed(0) + "px");\n' +
    '      c.style.setProperty("--dur", (1.6 + Math.random() * 1.6).toFixed(2) + "s");\n' +
    '      c.style.setProperty("--delay", (Math.random() * 1.5).toFixed(2) + "s");\n' +
    '      var ang = Math.random() * Math.PI * 2, r = Math.random() * 0.42 + 0.08;\n' +
    '      c.style.left = (50 + Math.cos(ang) * r * 100 - 5) + "%";\n' +
    '      c.style.top  = (50 + Math.sin(ang) * r * 100 - 5) + "%";\n' +
    '      coinsEl.appendChild(c);\n' +
    '    }\n' +
    '  }\n' +

    // ── segments ───────────────────────────────────────────────────────────
    '  function segments(){\n' +
    '    var t = total(), angle = 0;\n' +
    '    return players.map(function(p){\n' +
    '      var size = (p.amount / t) * Math.PI * 2;\n' +
    '      var seg = {player: p, start: angle, end: angle + size};\n' +
    '      angle += size; return seg;\n' +
    '    });\n' +
    '  }\n' +

    // ── drawWheel ──────────────────────────────────────────────────────────
    '  function drawWheel(){\n' +
    '    var W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;\n' +
    '    var outerR = W / 2 - 10, innerR = outerR * 0.66;\n' +
    '    ctx.clearRect(0, 0, W, H);\n' +
    '    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2);\n' +
    '    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);\n' +
    '    ctx.fillStyle = "#e2f1fb"; ctx.fill();\n' +
    '    if(players.length){\n' +
    '      segments().forEach(function(s){\n' +
    '        var a0 = s.start + rotation - Math.PI / 2, a1 = s.end + rotation - Math.PI / 2;\n' +
    '        ctx.save(); ctx.beginPath();\n' +
    '        ctx.arc(cx, cy, outerR, a0, a1); ctx.arc(cx, cy, innerR, a1, a0, true);\n' +
    '        ctx.closePath(); ctx.fillStyle = s.player.color; ctx.fill();\n' +
    '        ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 4; ctx.stroke();\n' +
    '        ctx.restore();\n' +
    '      });\n' +
    '    }\n' +
    '    ctx.lineWidth = 3; ctx.strokeStyle = "#c9e4f7";\n' +
    '    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.stroke();\n' +
    '    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.stroke();\n' +
    '  }\n' +

    // ── positionAvatars ────────────────────────────────────────────────────
    '  function positionAvatars(){\n' +
    '    var segs = players.length ? segments() : [];\n' +
    '    var cssSize = Math.min(340, window.innerWidth * 0.92);\n' +
    '    var cx = cssSize / 2, cy = cssSize / 2;\n' +
    '    var outerR = cssSize / 2 - 10, innerR = outerR * 0.66, r = (outerR + innerR) / 2;\n' +
    '    while(avatarsEl.children.length > segs.length) avatarsEl.lastChild.remove();\n' +
    '    while(avatarsEl.children.length < segs.length){\n' +
    '      var el = document.createElement("div"); el.className = "seg-avatar";\n' +
    '      var hex = document.createElement("div"); hex.className = "hex";\n' +
    '      hex.style.background = "#fff";\n' +
    '      var img = document.createElement("img"); img.className = "hex-img"; img.style.display = "none";\n' +
    '      var letterSpan = document.createElement("span"); letterSpan.className = "hex-letter";\n' +
    '      hex.appendChild(img); hex.appendChild(letterSpan);\n' +
    '      el.appendChild(hex); avatarsEl.appendChild(el);\n' +
    '    }\n' +
    '    segs.forEach(function(s, i){\n' +
    '      var mid = (s.start + s.end) / 2 + rotation - Math.PI / 2;\n' +
    '      var x = cx + Math.cos(mid) * r, y = cy + Math.sin(mid) * r;\n' +
    '      var el = avatarsEl.children[i];\n' +
    '      el.style.transform = "translate(" + (x - 17) + "px," + (y - 19) + "px)";\n' +
    '      var hex = el.firstChild;\n' +
    '      var img = hex.querySelector(".hex-img");\n' +
    '      var letterSpan = hex.querySelector(".hex-letter");\n' +
    '      if(s.player.avatarUrl){\n' +
    '        if(img.src !== s.player.avatarUrl) img.src = s.player.avatarUrl;\n' +
    '        img.style.display = "block"; letterSpan.style.display = "none";\n' +
    '      } else {\n' +
    '        var letter = s.player.name[0].toUpperCase();\n' +
    '        img.style.display = "none"; letterSpan.style.display = "flex";\n' +
    '        if(letterSpan.textContent !== letter) letterSpan.textContent = letter;\n' +
    '        if(hex.style.color !== s.player.color) hex.style.color = s.player.color;\n' +
    '      }\n' +
    '    });\n' +
    '  }\n' +

    // ── renderPlayers ──────────────────────────────────────────────────────
    '  function renderPlayers(){\n' +
    '    listEl.innerHTML = "";\n' +
    '    var t = total();\n' +
    '    var sorted = [].concat(players).sort(function(a, b){ return b.amount - a.amount; });\n' +
    '    sorted.forEach(function(p){\n' +
    '      var row = document.createElement("div"); row.className = "player-item";\n' +
    '      row.innerHTML = \'<div class="dot" style="background:\' + p.color + \'"></div>\' +\n' +
    '        \'<div class="name">\' + p.name + \'</div>\' +\n' +
    '        \'<div class="amount">\' + p.amount.toFixed(2) + \'</div>\' +\n' +
    '        \'<div class="chance">\' + (t > 0 ? (p.amount / t * 100).toFixed(1) : "0.0") + \'%</div>\';\n' +
    '      listEl.appendChild(row);\n' +
    '    });\n' +
    '  }\n' +

    // ── updateTimerText ────────────────────────────────────────────────────
    '  function updateTimerText(){\n' +
    '    if(phase === "spinning" || animating) return;\n' +
    '    if(phase === "finished"){ timerEl.textContent = ""; return; }\n' +
    '    if(deadline === null){\n' +
    '      timerEl.classList.add("waiting");\n' +
    '      timerEl.textContent = players.length === 0 ? WAIT\n' +
    '        : players.length < MIN_BETS ? NEED : WAIT;\n' +
    '    } else {\n' +
    '      timerEl.classList.remove("waiting");\n' +
    '      var left = Math.max(0, deadline - Date.now());\n' +
    '      var s = Math.floor(left / 1000), cs = Math.floor((left % 1000) / 10);\n' +
    '      timerEl.textContent = String(s).padStart(2, "0") + ":" + String(cs).padStart(2, "0");\n' +
    '    }\n' +
    '  }\n' +

    // ── render ─────────────────────────────────────────────────────────────
    '  function render(){\n' +
    '    potEl.textContent = PRIZE.toFixed(2);\n' +
    '    betsCountEl.textContent = players.length + " СТАВОК";\n' +
    '    drawWheel(); positionAvatars(); renderPlayers(); updateTimerText();\n' +
    '    betBtn.disabled = (phase !== "betting");\n' +
    '  }\n' +

    // ── Timer tick (local countdown display only) ───────────────────────────
    '  setInterval(function(){\n' +
    '    if(phase === "betting") updateTimerText();\n' +
    '  }, 50);\n' +

    // ── Event listeners ────────────────────────────────────────────────────
    '  betBtn.addEventListener("click", function(){\n' +
    '    placeBet(parseFloat(amtInput.value));\n' +
    '  });\n' +
    '  amtInput.addEventListener("keydown", function(e){\n' +
    '    if(e.key === "Enter") betBtn.click();\n' +
    '  });\n' +

    // Expose for React Native injection
    '  window.onServerState   = onServerState;\n' +
    '  window.showError       = showError;\n' +
    '  window.updateNotifyState = updateNotifyState;\n' +

    // Signal React Native that WebView is ready
    '  if(window.ReactNativeWebView){\n' +
    '    window.ReactNativeWebView.postMessage(JSON.stringify({type:"ready"}));\n' +
    '  }\n' +

    '  render();\n' +
    '})();\n' +
    '</script></body></html>'
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export const WheelOfFortuneScreen: React.FC = () => {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const [html, setHtml] = useState<string | null>(null);
  const [connectionFailed, setConnectionFailed] = useState(false);
  // Driven by the server (jackpot:state.notify), not just local taps — the
  // cooldown and send count are shared across every player (not per-round,
  // not per-user), so the truth has to live server-side; this screen just
  // reflects it whenever a fresh state arrives (on join/reconnect too).
  // Fallback values (before the first state arrives) match the agreed
  // defaults — 5 min cooldown, 3 sends — never the actual source of truth.
  const [notifyCooldownUntil, setNotifyCooldownUntil] = useState<number | null>(null);
  const [notifySendCount, setNotifySendCount] = useState(0);
  const [notifyMaxSends, setNotifyMaxSends] = useState(3);
  const [hasBetThisRound, setHasBetThisRound] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const webViewRef    = useRef<WebView>(null);
  const nickRef       = useRef('You');
  const avatarUrlRef  = useRef<string | null>(null);
  const started       = useRef(false);
  const webViewReady  = useRef(false);
  const pendingState  = useRef<any>(null);  // buffer state received before WebView ready
  const lastPhaseRef  = useRef<string | null>(null);
  // Frozen to whatever nick was used for the first bet in the current round,
  // and reused for every subsequent bet in that same round — otherwise
  // changing your profile nickname mid-round (the server identifies players
  // by nick, not a stable user id) makes the second bet look like a whole
  // different player joined, instead of adding to your existing one.
  const activeRoundNickRef = useRef<string | null>(null);
  // Set the instant a bet is sent to the server (see onMessage below) so the
  // "notify" button responds immediately instead of waiting for a
  // round-trip jackpot:state that confirms it via the players list — useful
  // if that confirmation is ever slow, or the players list doesn't include
  // the bettor for a beat or two.
  const localBetThisRoundRef = useRef(false);

  // Only for someone who actually has a bet in, and only when the shared
  // cooldown/send-cap allows it — but the server has the final say (e.g.
  // two people tapping at nearly the same moment), hence the 409/403/429
  // handling below rather than trusting the pre-emptive client guard alone.
  const notifyAvailable =
    notifySendCount < notifyMaxSends &&
    (notifyCooldownUntil === null || notifyCooldownUntil <= Date.now());

  const handleNotify = useCallback(async () => {
    if (!notifyAvailable || notifying || !hasBetThisRound) return;
    setNotifying(true);
    try {
      const result = await notificationsApi.triggerJackpotAlert();
      // Optimistic sync from the response — the next jackpot:state push
      // will reconcile this with the authoritative server value anyway.
      if (result?.cooldownUntil !== undefined) setNotifyCooldownUntil(result.cooldownUntil);
      else setNotifyCooldownUntil(Date.now() + 5 * 60 * 1000);
      if (result?.sendCount !== undefined) setNotifySendCount(result.sendCount);
      else setNotifySendCount((prev) => prev + 1);
      if (result?.maxSends !== undefined) setNotifyMaxSends(result.maxSends);
    } catch (e: any) {
      if (e?.statusCode === 409 || e?.statusCode === 429) {
        // Someone beat us to it, or the shared cooldown kicked in between
        // our pre-emptive check and the server's — sync via the next state
        // push rather than guessing a cooldown value here.
        Alert.alert(
          language === 'en' ? 'Not available yet' : 'Пока недоступно',
          language === 'en'
            ? 'The invite was just sent by another player — try again later.'
            : 'Приглашение только что отправил другой игрок — попробуйте позже.',
        );
      } else if (e?.statusCode === 403) {
        Alert.alert(
          language === 'en' ? 'Place a bet first' : 'Сначала сделайте ставку',
          language === 'en'
            ? 'You need an active bet this round to notify others.'
            : 'Чтобы оповестить других, сначала сделайте ставку в этом раунде.',
        );
      } else {
        Alert.alert(
          language === 'en' ? 'Error' : 'Ошибка',
          language === 'en'
            ? 'Could not notify players. Try again.'
            : 'Не удалось отправить оповещение. Попробуйте снова.',
        );
      }
    } finally {
      setNotifying(false);
    }
  }, [notifyAvailable, notifying, hasBetThisRound, language]);

  // ── Connect with retry + backoff, surfaced as a real error state instead of
  //    silently hanging on the WebView's internal "Connecting…" forever ──────
  const connectWithRetry = useCallback(async () => {
    const MAX_ATTEMPTS = 3;
    setConnectionFailed(false);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        await socketService.connect();
        return;
      } catch {
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    setConnectionFailed(true);
  }, []);

  // ── Inject JS into WebView (safe — checks ready flag) ─────────────────────
  const injectJS = useCallback((code: string) => {
    if (webViewRef.current && webViewReady.current) {
      webViewRef.current.injectJavaScript(`(function(){${code}})();true;`);
    }
  }, []);

  // ── Forward server state to WebView ───────────────────────────────────────
  const applyState = useCallback((state: unknown) => {
    if (!webViewReady.current) {
      pendingState.current = state;   // buffer until WebView is ready
      return;
    }
    injectJS('typeof onServerState==="function"&&onServerState(' + JSON.stringify(state) + ')');
  }, [injectJS]);

  // ── On mount: load nick + balance, build HTML, connect socket ──────────────
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    Promise.all([
      AsyncStorage.getItem(NICK_KEY).catch(() => null),
      AsyncStorage.getItem(AVATAR_URL_KEY).catch(() => null),
      bonusApi.getBalance().catch(() => null),
    ]).then(([nickRes, avatarRes, balRes]) => {
      const nick    = (nickRes as string | null) ?? 'You';
      const balance = Number((balRes as any)?.available) || 0;
      nickRef.current = nick;
      avatarUrlRef.current = (avatarRes as string | null) ?? null;
      setHtml(buildHtml(nick, balance, language, avatarUrlRef.current));

      // Ensure socket is connected
      void connectWithRetry();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket listeners (set up once HTML is ready) ───────────────────────────
  useEffect(() => {
    if (!html) return;

    const onState = (state: unknown) => {
      const s = state as any;
      const phase = s?.phase;
      if (typeof phase === 'string') {
        // A round ending and a new one starting again is what lets the next
        // round pick up a fresh bet / whatever nickname is current — the
        // notify cooldown/count themselves are NOT round-scoped any more,
        // so they're intentionally left alone here.
        if (lastPhaseRef.current === 'finished' && phase !== 'finished') {
          localBetThisRoundRef.current = false;
          activeRoundNickRef.current = null;
        }
        lastPhaseRef.current = phase;
      }

      // Whether I have an active bet this round — trust either signal: the
      // server's player list (authoritative, but can lag a beat behind a
      // bet just sent), or the local flag set the instant a bet was sent.
      // Compare against the frozen round nick (if a bet has landed already)
      // so this stays correct even if the profile nickname changed since.
      const players = Array.isArray(s?.players) ? s.players : [];
      const myNick = (activeRoundNickRef.current ?? nickRef.current).toLowerCase();
      const confirmedByServer = players.some(
        (p: any) => String(p?.nick ?? p?.name ?? '').toLowerCase() === myNick,
      );
      setHasBetThisRound(confirmedByServer || localBetThisRoundRef.current);

      // Shared notify cooldown/send-count — server-authoritative, so this
      // is correct even right after a fresh app launch/reconnect, not just
      // something remembered locally. `notify` may be absent from older
      // server responses before this contract is deployed; defaults above
      // keep the button simply available in that case.
      const notify = s?.notify;
      if (notify && typeof notify === 'object') {
        if (notify.cooldownUntil !== undefined) setNotifyCooldownUntil(notify.cooldownUntil);
        if (typeof notify.sendCount === 'number') setNotifySendCount(notify.sendCount);
        if (typeof notify.maxSends === 'number') setNotifyMaxSends(notify.maxSends);
      }

      applyState(state);
    };
    const onError = (data: unknown) => {
      const msg = typeof data === 'string' ? data : ((data as any)?.message ?? 'Error');
      injectJS('typeof showError==="function"&&showError(' + JSON.stringify(msg) + ')');
    };

    socketService.on('jackpot:state', onState);
    socketService.on('jackpot:error', onError);

    return () => {
      socketService.off('jackpot:state', onState);
      socketService.off('jackpot:error', onError);
      socketService.emit('jackpot:leave', { nick: nickRef.current });
      webViewReady.current = false;
    };
  }, [html, applyState, injectJS]);

  // ── Push the "notify" button's state into the WebView (it now lives in the
  //    HTML panel instead of the native header) whenever any of it changes ──
  useEffect(() => {
    injectJS(
      'typeof updateNotifyState==="function"&&updateNotifyState(' +
        JSON.stringify({
          hasBet: hasBetThisRound,
          busy: notifying,
          cooldownUntil: notifyCooldownUntil,
          sendCount: notifySendCount,
          maxSends: notifyMaxSends,
        }) +
        ')',
    );
  }, [hasBetThisRound, notifying, notifyCooldownUntil, notifySendCount, notifyMaxSends, injectJS]);

  // ── Handle messages from WebView ───────────────────────────────────────────
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; amount?: number };

      if (msg.type === 'ready') {
        webViewReady.current = true;
        // Emit join to server
        socketService.emit('jackpot:join', { nick: nickRef.current, avatarUrl: avatarUrlRef.current });
        // Flush buffered state
        if (pendingState.current !== null) {
          injectJS('typeof onServerState==="function"&&onServerState(' +
            JSON.stringify(pendingState.current) + ')');
          pendingState.current = null;
        }
      } else if (msg.type === 'bet' && typeof msg.amount === 'number') {
        // Lock in the nick for this round on the first bet — subsequent
        // bets reuse it even if the profile nickname changes in between.
        if (!activeRoundNickRef.current) activeRoundNickRef.current = nickRef.current;
        localBetThisRoundRef.current = true;
        setHasBetThisRound(true);
        socketService.emit('jackpot:bet', {
          nick:   activeRoundNickRef.current,
          amount: msg.amount,
          avatarUrl: avatarUrlRef.current,
        });
      } else if (msg.type === 'notify') {
        void handleNotify();
      }
    } catch { /* ignore malformed messages */ }
  }, [injectJS, handleNotify]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={wp(26)} color="#1E293B" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'en' ? 'Jackpot' : 'Джекпот'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {connectionFailed ? (
        <View style={styles.loader}>
          <Text style={styles.errorTitle}>
            {language === 'en' ? 'Could not connect' : 'Не удалось подключиться'}
          </Text>
          <Text style={styles.errorText}>
            {language === 'en'
              ? 'Check your connection and try again.'
              : 'Проверьте соединение и попробуйте снова.'}
          </Text>
          <TouchableOpacity
            onPress={() => void connectWithRetry()}
            style={styles.retryBtn}
            accessibilityRole="button">
            <Text style={styles.retryBtnText}>
              {language === 'en' ? 'Retry' : 'Повторить'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : html ? (
        <WebView
          ref={webViewRef}
          source={{ html, baseUrl: 'about:blank' }}
          style={styles.webview}
          scrollEnabled
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          showsVerticalScrollIndicator={false}
          mixedContentMode="compatibility"
          onMessage={onMessage}
        />
      ) : (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(14), paddingVertical: hp(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: wp(40), height: wp(40), borderRadius: wp(20),
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
  },
  headerSpacer: { width: wp(40) },
  headerTitle: { fontSize: fontSize(20), fontWeight: '800', color: '#1E293B' },
  webview:  { flex: 1, backgroundColor: 'transparent' },
  loader:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: wp(24) },
  errorTitle: { fontSize: fontSize(17), fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  errorText: {
    marginTop: hp(6), fontSize: fontSize(13), color: '#64748B',
    textAlign: 'center', lineHeight: fontSize(19),
  },
  retryBtn: {
    marginTop: hp(20), backgroundColor: '#0EA5E9',
    paddingHorizontal: wp(24), paddingVertical: hp(12), borderRadius: wp(14),
  },
  retryBtnText: { fontSize: fontSize(14), fontWeight: '700', color: '#FFFFFF' },
});
