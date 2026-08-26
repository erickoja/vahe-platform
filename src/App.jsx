import { useState, useCallback, useMemo, useEffect, useRef, Component } from "react";
import { createPortal } from "react-dom";
import { supabase, supabaseEnabled, STATE_TABLE } from "./supabaseClient";
// Iframe-safe overrides
// Only suppress alert/confirm inside Claude artifact iframes, not standalone
try{
  const inIframe=window.self!==window.top;
  if(inIframe){
    window.alert=(m)=>{
      // Show a visible toast instead of silent suppression
      const d=document.createElement('div');
      d.textContent=m;
      Object.assign(d.style,{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',
        background:'#A33028',color:'#fff',padding:'12px 24px',borderRadius:'4px',fontSize:'13px',
        fontWeight:'700',zIndex:'99999',fontFamily:"'Poppins',sans-serif",maxWidth:'480px',textAlign:'center',
        boxShadow:'0 4px 20px rgba(0,0,0,0.3)'});
      document.body.appendChild(d);
      setTimeout(()=>d.remove(),3500);
    };
    window.confirm=(m)=>{
      // In iframe, show toast and return true (can't block)
      const d=document.createElement('div');
      d.textContent='⚠ '+m;
      Object.assign(d.style,{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',
        background:'#B06A10',color:'#fff',padding:'12px 24px',borderRadius:'4px',fontSize:'13px',
        fontWeight:'700',zIndex:'99999',fontFamily:"'Poppins',sans-serif",maxWidth:'480px',textAlign:'center',
        boxShadow:'0 4px 20px rgba(0,0,0,0.3)'});
      document.body.appendChild(d);
      setTimeout(()=>d.remove(),2000);
      return true;
    };
  }
}catch(e){}

// ── Tokens ────────────────────────────────────────────────────────────────
const GOLD="#BA7067",GOLD_L="#F4E6E3",GOLD_D="#A65A50",INK="#17130F",PARCH="#F4EEE8",WG="#8B837C",BD="#ECE4DB",WHITE="#FFFFFF",OK="#2D7A4F",OK_BG="#EAF5EF",DANGER="#C0392B",WARN="#B06A10";
// Monochrome (black & white) system
const CREAM="#FBF9F8";          // app background (warm cream — matches workshoppilot.app)
const BD_SOFT="#ECECEE";        // softer hairline border
const RADIUS=12;                // card corner radius (soft — matches workshoppilot.app)
const SHADOW="0 2px 6px rgba(72,60,84,0.05),0 18px 40px -22px rgba(72,60,84,0.20)";
const SHADOW_HV="0 6px 18px rgba(20,20,22,0.10),0 16px 36px rgba(20,20,22,0.12)";
// Stat-tile treatments — neutral by default; a couple carry a functional status hint
const _NEU={bg:WHITE,ring:"#F0F0F2",fg:INK};
// Muted jewel tones — soft coloured icon wash + number in the same hue, on a clean white card.
const TINTS={
  blue:{bg:WHITE,ring:"#E9F0F5",fg:"#4E8B6A"},
  lilac:{bg:WHITE,ring:"#EEEAF5",fg:"#6E5B96"},
  mint:{bg:WHITE,ring:"#E7F1EC",fg:OK},
  gold:{bg:WHITE,ring:GOLD_L,fg:GOLD_D},
  peach:{bg:WHITE,ring:"#F7EAE1",fg:"#A65D32"},
  rose:{bg:WHITE,ring:"#FBEAEA",fg:DANGER},   // overdue / alert
  slate:{bg:WHITE,ring:"#EFE9E1",fg:"#5D5A57"},   // neutral — plain informational counts
};

// ── Constants ─────────────────────────────────────────────────────────────
const JOB_TYPES=["Engagement ring","Wedding band","Eternity ring","Dress ring","Custom pendant","Necklace","Earrings","Bracelet","Repair","Remodelling","Grillz","Chain","Trade / Wholesale","Custom","Other"];
// Piece-type icons for the job-type filter tiles (currentColor → inherit tile colour).
const ICON_RING=<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3,14A9,9,0,1,0,14.822,5.46l1.019-1.585a1,1,0,0,0,.031-1.032l-.75-1.333A1,1,0,0,0,14.25,1H9.75a1,1,0,0,0-.872.51l-.75,1.333a1,1,0,0,0,.031,1.032L9.178,5.46A9.011,9.011,0,0,0,3,14Zm8.282-8.966L10.167,3.3l.168-.3h3.33l.168.3L12.718,5.034C12.468,5.011,12.23,5,12,5S11.532,5.011,11.282,5.034ZM12,7a7,7,0,1,1-7,7A7.022,7.022,0,0,1,12,7Z"/></svg>;
const ICON_WEDDING_RINGS=<svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor"><path d="M176.172,189.568c-69.82,0-126.624,56.803-126.624,126.624s56.803,126.624,126.624,126.624s126.624-56.803,126.624-126.624S245.992,189.568,176.172,189.568z M176.172,420.794c-57.678,0-104.602-46.924-104.602-104.602c0-55.447,43.367-100.948,97.962-104.385c-6.387,18.212-9.875,37.775-9.875,58.14c0,55.832,26.123,105.66,66.77,137.959C211.503,416.115,194.374,420.794,176.172,420.794z M245.306,394.618c-38.527-28.05-63.629-73.476-63.629-124.671c0-20.149,3.902-39.399,10.966-57.057c9.291,1.475,18.179,4.174,26.491,7.933c-6.388,15.112-9.93,31.711-9.93,49.122c0,42.927,21.48,80.919,54.247,103.829C258.338,381.499,252.229,388.508,245.306,394.618z M231.226,269.946c0-13.34,2.521-26.098,7.095-37.838c25.736,19.074,42.453,49.662,42.453,84.084c0,13.335-2.513,26.092-7.082,37.831C247.951,334.949,231.226,304.37,231.226,269.946z"/><path d="M374.633,98.09l14.704-24.751c2.059-3.466,2.059-7.78,0-11.247l-22.021-37.069c-1.985-3.34-5.581-5.388-9.467-5.388h-44.043c-3.885,0-7.482,2.047-9.467,5.388l-22.021,37.069c-2.059,3.466-2.059,7.78,0,11.247l14.704,24.751c-32.271,7.286-61.211,23.456-84.112,45.794c-11.854-2.525-24.141-3.864-36.736-3.864C79.031,140.02,0,219.05,0,316.193s79.031,176.172,176.172,176.172c47.778,0,91.166-19.127,122.934-50.114c11.849,2.526,24.13,3.869,36.722,3.869C432.97,446.119,512,367.09,512,269.947C512,186.135,453.167,115.813,374.633,98.09z M320.072,41.657h31.512l15.48,26.058l-15.48,26.059h-31.512l-15.48-26.059L320.072,41.657z M176.172,470.342c-84.999,0-154.151-69.152-154.151-154.151s69.152-154.151,154.151-154.151s154.15,69.152,154.15,154.151S261.171,470.342,176.172,470.342z M285.592,178.222c14.918-8.205,32.041-12.878,50.237-12.878c57.678,0,104.601,46.925,104.601,104.602c0,55.445-43.364,100.945-97.956,104.385c6.385-18.212,9.87-37.775,9.87-58.14C352.344,260.363,326.234,210.523,285.592,178.222z M335.828,424.097c-6.62,0-13.14-0.428-19.542-1.244c6.287-8.239,11.873-17.041,16.651-26.326c0.962,0.022,1.926,0.044,2.893,0.044c69.82,0,126.623-56.803,126.623-126.624s-56.802-126.624-126.623-126.624c-25.898,0-49.989,7.837-70.069,21.234c-8.868-5.26-18.233-9.765-28.009-13.424c26.669-22.056,60.846-35.338,98.077-35.338c84.999,0,154.151,69.152,154.151,154.151S420.827,424.097,335.828,424.097z"/></svg>;
const ICON_PENDANT=<svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor"><path d="M256,208.591c-47.057,0-85.336,38.279-85.336,85.336c0,47.057,38.279,85.336,85.336,85.336c47.057,0,85.336-38.279,85.336-85.336C341.336,246.87,303.057,208.591,256,208.591z M256,360.3c-36.594,0-66.373-29.779-66.373-66.373s29.779-66.373,66.373-66.373c36.594,0,66.373,29.779,66.373,66.373S292.594,360.3,256,360.3z"/><path d="M502.527,66.364c-2.908,0-71.466,0.472-102.402,41.724c-23.945,31.92-63.025,49.974-70.53,53.24c-21.813-12.155-46.902-19.109-73.595-19.109c-26.691,0-51.78,6.954-73.593,19.109c-7.473-3.231-46.488-21.186-70.533-53.24C80.938,66.836,12.38,66.364,9.473,66.364C4.241,66.364,0,70.605,0,75.836c-0.009,5.232,4.232,9.482,9.463,9.491c0.62,0,62.021,0.509,87.244,34.131c20.704,27.612,50.381,45.485,67.155,54.06c-36.182,27.753-59.571,71.391-59.571,120.409c0,83.651,68.058,151.709,151.709,151.709c83.651,0,151.709-68.058,151.709-151.709c0-49.018-23.39-92.656-59.569-120.409c16.771-8.574,46.448-26.448,67.153-54.06c25.223-33.622,86.624-34.131,87.244-34.131c5.232-0.009,9.473-4.259,9.463-9.491C512,70.605,507.759,66.364,502.527,66.364z M388.746,293.927c0,73.197-59.548,132.746-132.746,132.746s-132.746-59.548-132.746-132.746S182.803,161.182,256,161.182S388.746,220.73,388.746,293.927z"/></svg>;
const ICON_EARRING=<svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor"><path d="M149.299,181.001c-2.202-3.311-5.163-5.931-8.499-7.868V74.445c14.865-5.299,25.6-19.379,25.6-36.045C166.4,17.229,149.171,0,128,0S89.6,17.229,89.6,38.4c0,16.666,10.735,30.737,25.6,36.045v98.697c-3.337,1.937-6.298,4.557-8.499,7.868C97.084,195.413,12.8,323.951,12.8,396.8C12.8,460.322,64.478,512,128,512s115.2-51.678,115.2-115.2C243.2,323.951,158.916,195.413,149.299,181.001z M128,25.6c7.066,0,12.8,5.726,12.8,12.8c0,7.066-5.734,12.8-12.8,12.8s-12.8-5.734-12.8-12.8C115.2,31.326,120.934,25.6,128,25.6z M128,198.076c0,0,64,96,64,144c0,35.354-28.655,64-64,64s-64-28.655-64-64C64,294.076,128,198.076,128,198.076z M128,486.4c-49.485,0-89.6-40.115-89.6-89.6c0-8.713,1.553-18.586,4.181-29.116c11.093,36.881,44.971,63.991,85.419,63.991s74.325-27.11,85.419-63.991c2.62,10.53,4.181,20.403,4.181,29.116C217.6,446.285,177.485,486.4,128,486.4z"/><path d="M405.299,181.001c-2.21-3.311-5.163-5.931-8.499-7.868V74.445c14.865-5.299,25.6-19.379,25.6-36.045C422.4,17.229,405.171,0,384,0c-21.171,0-38.4,17.229-38.4,38.4c0,16.666,10.735,30.737,25.6,36.045v98.697c-3.336,1.937-6.298,4.557-8.499,7.868C353.084,195.413,268.8,323.951,268.8,396.8c0,63.522,51.678,115.2,115.2,115.2s115.2-51.678,115.2-115.2C499.2,323.951,414.916,195.413,405.299,181.001z M384,25.6c7.066,0,12.8,5.726,12.8,12.8c0,7.066-5.734,12.8-12.8,12.8c-7.066,0-12.8-5.734-12.8-12.8C371.2,31.326,376.934,25.6,384,25.6z M384,198.076c0,0,64,96,64,144c0,35.345-28.655,64-64,64c-35.345,0-64-28.655-64-64C320,294.076,384,198.076,384,198.076z M384,486.4c-49.485,0-89.6-40.115-89.6-89.6c0-8.713,1.553-18.586,4.181-29.116c11.093,36.881,44.971,63.991,85.419,63.991c40.448,0,74.325-27.119,85.419-63.991c2.62,10.53,4.181,20.403,4.181,29.116C473.6,446.285,433.485,486.4,384,486.4z"/></svg>;
const ICON_GRILLZ=<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.19807 4.45825C8.55418 4.22291 7.94427 4 7 4C5 4 4 6 4 8.5C4 10.0985 4.40885 11.0838 4.83441 12.1093C5.0744 12.6877 5.31971 13.2788 5.5 14C5.649 14.596 5.7092 15.4584 5.77321 16.3755C5.92401 18.536 6.096 21 7.5 21C8.39898 21 8.79286 19.5857 9.22652 18.0286C9.75765 16.1214 10.3485 14 12 14C13.6515 14 14.2423 16.1214 14.7735 18.0286C15.2071 19.5857 15.601 21 16.5 21C17.904 21 18.076 18.536 18.2268 16.3755C18.2908 15.4584 18.351 14.596 18.5 14C18.6803 13.2788 18.9256 12.6877 19.1656 12.1093C19.5912 11.0838 20 10.0985 20 8.5C20 6 19 4 17 4C16.0557 4 15.4458 4.22291 14.8019 4.45825C14.082 4.72136 13.3197 5 12 5C10.6803 5 9.91796 4.72136 9.19807 4.45825Z"/></svg>;
const ICON_REPAIR=<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M 16.074219 0.1484375 L 15.853516 0.15429688 L 15.640625 0.20898438 L 15.443359 0.30664062 L 12.820312 2.0253906 L 12.640625 2.1738281 L 12.501953 2.3613281 L 12.132812 3 L 12.060547 3.1582031 L 12.013672 3.3261719 L 12 3.5 L 12 5.1777344 L 11.810547 5.4257812 L 11.666016 5.7050781 L 11.564453 6.0019531 L 10.957031 6.0019531 L 10.876953 5.65625 L 10.757812 5.3222656 L 10.601562 5.0019531 L 10.472656 4.8320312 L 10.316406 4.6894531 L 10.126953 4.5859375 L 9.9238281 4.5214844 L 9.7128906 4.5039062 L 9.4257812 4.5117188 L 9.1953125 4.546875 L 8.984375 4.6347656 L 8.7949219 4.7675781 L 8.6445312 4.9414062 L 8.4511719 5.1796875 L 8.2246094 5.3828125 L 7.9707031 5.5507812 L 7.6933594 5.6796875 L 7.4003906 5.7636719 L 6.515625 5.9746094 L 5.6464844 6.25 L 4.7988281 6.5839844 L 3.9785156 6.9785156 L 3.1855469 7.4296875 L 2.4296875 7.9316406 L 1.7070312 8.4882812 L 1.0273438 9.0917969 L 0.39257812 9.7441406 L 0.21484375 9.9804688 L 0.087890625 10.244141 L 0.017578125 10.53125 L 0 10.824219 L 0.04296875 11.115234 L 0.14257812 11.392578 L 0.29296875 11.644531 L 0.49023438 11.863281 L 0.72460938 12.037109 L 0.99023438 12.164062 L 1.2734375 12.238281 L 1.5703125 12.251953 L 1.859375 12.210938 L 2.1367188 12.113281 L 2.3886719 11.960938 L 2.609375 11.763672 L 3.140625 11.224609 L 3.7109375 10.722656 L 4.3203125 10.269531 L 4.9589844 9.8632812 L 5.6289062 9.5039062 L 6.3242188 9.1992188 L 7.0410156 8.9472656 L 7.7734375 8.7519531 L 8.5195312 8.609375 L 9.2753906 8.5253906 L 10.03125 8.5 L 10.255859 8.4765625 L 10.466797 8.4003906 L 10.658203 8.28125 L 10.816406 8.125 L 10.933594 7.9335938 L 11.009766 7.7226562 L 11.035156 7.4980469 L 11.767578 7.4980469 L 11.966797 7.7851562 L 12.214844 8.0332031 L 12.498047 8.2324219 L 12.498047 8.9648438 L 12.275391 8.9902344 L 12.0625 9.0625 L 11.875 9.1816406 L 11.714844 9.3417969 L 11.595703 9.5332031 L 11.523438 9.7441406 L 11.5 9.96875 L 11.474609 10.724609 L 11.390625 11.480469 L 11.248047 12.226562 L 11.050781 12.958984 L 10.800781 13.673828 L 10.494141 14.371094 L 10.136719 15.037109 L 9.7304688 15.679688 L 9.2734375 16.289062 L 8.7753906 16.859375 L 8.2363281 17.390625 L 8.0390625 17.609375 L 7.8867188 17.861328 L 7.7890625 18.140625 L 7.7480469 18.429688 L 7.7617188 18.722656 L 7.8359375 19.009766 L 7.9589844 19.275391 L 8.1367188 19.509766 L 8.3535156 19.707031 L 8.6074219 19.857422 L 8.8847656 19.957031 L 9.1757812 19.998047 L 9.46875 19.982422 L 9.7539062 19.910156 L 10.019531 19.785156 L 10.255859 19.607422 L 10.904297 18.972656 L 11.511719 18.291016 L 12.066406 17.570312 L 12.570312 16.814453 L 13.021484 16.021484 L 13.416016 15.201172 L 13.75 14.353516 L 14.025391 13.484375 L 14.236328 12.599609 L 14.320312 12.306641 L 14.449219 12.029297 L 14.617188 11.773438 L 14.820312 11.546875 L 15.058594 11.355469 L 15.232422 11.205078 L 15.365234 11.015625 L 15.453125 10.800781 L 15.488281 10.574219 L 15.496094 10.287109 L 15.478516 10.076172 L 15.416016 9.8691406 L 15.310547 9.6835938 L 15.167969 9.5234375 L 14.994141 9.3984375 L 14.677734 9.2421875 L 14.34375 9.1210938 L 14 9.0429688 L 14 8.4355469 L 14.294922 8.3339844 L 14.574219 8.1894531 L 14.822266 8 L 16.5 8 L 16.673828 7.9863281 L 16.84375 7.9394531 L 17 7.8671875 L 17.638672 7.4960938 L 17.826172 7.3554688 L 17.974609 7.1796875 L 19.693359 4.5566406 L 19.791016 4.359375 L 19.845703 4.1464844 L 19.851562 3.9257812 L 19.808594 3.7089844 L 19.722656 3.5078125 L 19.720703 3.5078125 L 19.427734 3 L 17.974609 3.8398438 L 17.849609 4.1328125 L 17.675781 4.4042969 L 17.462891 4.6425781 L 17.214844 4.8457031 L 16.939453 5.0078125 L 16.636719 5.1210938 L 16.324219 5.1855469 L 16.001953 5.2011719 L 15.685547 5.1621094 L 15.197266 5.4414062 L 15.017578 5.1972656 L 14.802734 4.9824219 L 14.556641 4.8027344 L 14.837891 4.3144531 L 14.800781 3.9960938 L 14.814453 3.6757812 L 14.878906 3.3632812 L 14.992188 3.0605469 L 15.150391 2.7832031 L 15.353516 2.5371094 L 15.595703 2.3222656 L 15.865234 2.1503906 L 16.160156 2.0253906 L 17 0.57226562 L 16.492188 0.27929688 L 16.289062 0.18945312 L 16.074219 0.1484375 z M 14.308594 2.2460938 L 14.111328 2.5859375 L 13.960938 2.9453125 L 13.857422 3.3261719 L 13.804688 3.7148438 L 13.804688 4.1054688 L 13.691406 4.3027344 L 13.601562 4.5039062 L 13.560547 4.71875 L 13.566406 4.9355469 L 13.619141 5.1503906 L 13.716797 5.3457031 L 13.857422 5.515625 L 14.027344 5.6503906 L 14.216797 5.8046875 L 14.365234 5.9980469 L 14.460938 6.2226562 L 14.498047 6.4628906 L 14.478516 6.703125 L 14.398438 6.9355469 L 14.269531 7.1386719 L 14.091797 7.3066406 L 13.878906 7.4257812 L 13.644531 7.4902344 L 13.400391 7.4960938 L 13.162109 7.4414062 L 12.945312 7.3339844 L 12.761719 7.1738281 L 12.621094 6.9765625 L 12.53125 6.75 L 12.498047 6.5097656 L 12.527344 6.2675781 L 12.611328 6.0390625 L 12.748047 5.8378906 L 12.884766 5.640625 L 12.970703 5.4140625 L 13 5.1777344 L 13 3.5 L 13.369141 2.8613281 L 14.308594 2.2460938 z M 9.7324219 5.5019531 L 9.8789062 5.8183594 L 9.96875 6.1542969 L 10 6.5 L 10 7 L 10.009766 7.2519531 L 10.035156 7.5019531 L 9.2011719 7.5273438 L 8.3710938 7.6210938 L 7.5507812 7.7773438 L 6.7441406 7.9921875 L 5.9570312 8.2695312 L 5.1914062 8.6074219 L 4.4570312 8.9980469 L 3.7519531 9.4453125 L 3.0820312 9.9472656 L 2.4550781 10.496094 L 1.8691406 11.091797 L 1.7324219 11.195312 L 1.5664062 11.25 L 1.3925781 11.242188 L 1.2304688 11.175781 L 1.1035156 11.058594 L 1.0214844 10.904297 L 1.0019531 10.734375 L 1.0351562 10.5625 L 1.1289062 10.417969 L 1.71875 9.8164062 L 2.3457031 9.2558594 L 3.0117188 8.7421875 L 3.7109375 8.2792969 L 4.4433594 7.8632812 L 5.2011719 7.5019531 L 5.9804688 7.1933594 L 6.78125 6.9375 L 7.5996094 6.7402344 L 7.96875 6.6425781 L 8.3203125 6.4960938 L 8.6503906 6.3046875 L 8.9550781 6.0761719 L 9.2285156 5.8085938 L 9.4667969 5.5097656 L 9.7324219 5.5019531 z M 17.753906 5.6914062 L 17.138672 6.6308594 L 16.5 7 L 15.435547 7 L 15.490234 6.7011719 L 15.496094 6.3964844 L 15.697266 6.3085938 L 15.894531 6.1953125 L 16.285156 6.1933594 L 16.673828 6.140625 L 17.050781 6.0390625 L 17.414062 5.8886719 L 17.753906 5.6914062 z M 12.498047 9.9648438 L 12.748047 9.9902344 L 13 10 L 13.5 10 L 13.845703 10.029297 L 14.181641 10.119141 L 14.498047 10.267578 L 14.490234 10.533203 L 14.191406 10.769531 L 13.923828 11.041016 L 13.691406 11.345703 L 13.501953 11.679688 L 13.357422 12.03125 L 13.255859 12.400391 L 13.0625 13.21875 L 12.806641 14.019531 L 12.498047 14.798828 L 12.136719 15.556641 L 11.720703 16.289062 L 11.253906 16.988281 L 10.744141 17.654297 L 10.183594 18.28125 L 9.5820312 18.867188 L 9.4335938 18.960938 L 9.265625 18.998047 L 9.0957031 18.974609 L 8.9414062 18.894531 L 8.8222656 18.765625 L 8.7578125 18.607422 L 8.75 18.433594 L 8.8007812 18.267578 L 8.9082031 18.130859 L 9.5039062 17.544922 L 10.052734 16.914062 L 10.554688 16.248047 L 11.001953 15.542969 L 11.392578 14.804688 L 11.730469 14.042969 L 12.007812 13.255859 L 12.222656 12.449219 L 12.378906 11.626953 L 12.46875 10.796875 L 12.498047 9.9648438 z "/></svg>;
const ICON_CUSTOM=<svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor"><path d="M8,9H4v3h4V9z M7,11H5v-1h2V11z M8,13H4v3h4V13z M7,15H5v-1h2V15z M6,17c-1.657,0-3,1.343-3,3s1.343,3,3,3s3-1.343,3-3S7.657,17,6,17z M6,22c-1.103,0-2-0.897-2-2c0-1.103,0.897-2,2-2s2,0.897,2,2C8,21.103,7.103,22,6,22z M21.646,11.646l0.707,0.707l-2,2l-0.707-0.707L21.646,11.646z M31,4h-1.586l-1.707-1.707c-0.391-0.391-1.023-0.391-1.414,0L24.586,4H1C0.448,4,0,4.448,0,5v22c0,0.552,0.448,1,1,1h30c0.552,0,1-0.448,1-1V5C32,4.448,31.552,4,31,4z M16,14v4h4l8-8v13H11V9h10L16,14z M17,14.707L19.293,17H17V14.707z M20.146,16.439l-2.586-2.586L27,4.414L29.586,7L20.146,16.439z M2,26V6h22l-2,2H10v16h19V9l1-1v18H2z"/></svg>;
const ICON_ALLJOBS=<svg width="20" height="20" viewBox="0 0 76.161 76.161" fill="currentColor"><path d="M62.943,20.161H13.216v-7.393h49.728V20.161z M13.216,46.369h19.712V26.657H13.216V46.369z M13.216,57.792h26.88c-0.673-0.672-1.345-1.567-1.792-2.464H13.216V57.792z M13.216,51.969h23.52c-0.224-0.896-0.672-1.566-0.896-2.465H13.216V51.969z M41.664,29.121c0.896-0.896,2.016-1.792,3.137-2.464h-6.497v2.464H41.664z M13.216,63.393h34.72c-1.567-0.672-2.912-1.567-4.479-2.465h-30.24V63.393z M75.936,49.504c-0.672,2.912-2.016,5.377-3.584,7.616l3.81,6.72V48.833C76.16,49.057,76.16,49.281,75.936,49.504z M63.393,72.801l-0.449-1.121H8.96c-2.464,0-4.48-2.016-4.48-4.479V8.96c0-2.464,2.016-4.479,4.48-4.479H67.2c2.464,0,4.479,2.017,4.479,4.479v21.728c0.896,0.896,1.566,2.019,2.238,3.139c1.12,1.792,1.792,3.584,2.24,5.603V8.96C76.16,4.033,72.128,0,67.2,0H8.96C4.032,0,0,4.033,0,8.96v58.24c0,4.928,4.032,8.96,8.96,8.96h56.448l-0.225-0.448L63.393,72.801z M40.768,52.865c-4.705-8.288-1.791-19.04,6.496-23.744c8.289-4.704,19.041-1.792,23.743,6.496c4.929,8.288,2.017,19.04-6.271,23.743C56.225,64.289,45.695,61.376,40.768,52.865z M63.168,56.897c6.943-4.033,9.409-12.994,5.376-19.938c-4.032-6.942-12.991-9.405-19.937-5.376c-6.943,4.034-9.407,12.994-5.375,19.938C47.264,58.465,56.225,60.928,63.168,56.897z M68.993,58.079l-7.565,4.367l5.822,10.088l7.566-4.366L68.993,58.079z M68.096,73.92c1.121,2.016,3.811,2.688,5.824,1.568c2.016-1.12,2.688-3.809,1.568-5.824L68.096,73.92z"/></svg>;
const ICON_CHECK=<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3.338A9.95 9.95 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10q-.002-1.03-.2-2"/><path d="M8 12.5s1.5 0 3.5 3.5c0 0 5.559-9.167 10.5-11"/></svg>;
const ICON_DOLLAR=<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 14c0-3.507 0-5.26.908-6.44q.25-.325.554-.592C4.57 6 6.212 6 9.5 6h5c3.288 0 4.931 0 6.038.968q.304.268.554.592C22 8.74 22 10.493 22 14s0 5.26-.908 6.44a4 4 0 0 1-.554.591C19.43 22 17.788 22 14.5 22h-5c-3.287 0-4.931 0-6.038-.968a4 4 0 0 1-.554-.592C2 19.26 2 17.507 2 14m14-8c0-1.886 0-2.828-.586-3.414S13.886 2 12 2s-2.828 0-3.414.586S8 4.114 8 6"/><path d="M12 11c-1.105 0-2 .672-2 1.5s.895 1.5 2 1.5s2 .672 2 1.5s-.895 1.5-2 1.5m0-6c.87 0 1.612.417 1.886 1M12 11v-1m0 7c-.87 0-1.612-.417-1.886-1M12 17v1m-6-6H2m20 0h-4"/></svg>;
const JOB_TYPE_ICONS={"Engagement ring":ICON_RING,"Wedding band":ICON_WEDDING_RINGS,"Eternity ring":ICON_RING,"Dress ring":ICON_RING,"Custom pendant":ICON_PENDANT,"Necklace":ICON_PENDANT,"Earrings":ICON_EARRING,"Bracelet":"∞","Repair":ICON_REPAIR,"Remodelling":"⟳","Grillz":ICON_GRILLZ,"Chain":"◈","Trade / Wholesale":"⇄","Custom":ICON_CUSTOM,"Other":"◦"};
// "On the bench" is the active-work stage — fits a repair being worked on (and any workshop job).
const REPAIR_WIP_STAGE="On the bench";
const JOB_STAGES=["Enquiry","Consultation","Quoted","Approved","Item ordered","On the bench","Design / CAD","3D printing","Manufacturing","Stone setting","Polishing / Finish","QC check","Ready for collection","In transit to customer","Collected"];
// Finished/awaiting-pickup jobs — never treated as urgent (sorted last, not flagged overdue).
const DONE_STAGES=["Ready for collection","Collected"];
const jobIsDone=j=>DONE_STAGES.includes(j?.stage);
const SC={"Enquiry":"#A0845C","Consultation":"#7A6C5D","Quoted":"#5E9078","Approved":"#4E8B6A","Item ordered":"#5E7CA6","On the bench":"#3E8E8E","Design / CAD":"#96627C","3D printing":"#8A6FA8","Manufacturing":"#B05C3A","Stone setting":"#C47A2E","Polishing / Finish":"#8B9E3A","QC check":"#4A8E6A","Ready for collection":"#2D7A4F","In transit to customer":"#3E86A0","Collected":"#1A5C3A"};
// Advance a job to "On the bench" only if it isn't already at/past that point (never pull it back).
const advanceToBench=stage=>{const i=JOB_STAGES.indexOf(stage),b=JOB_STAGES.indexOf(REPAIR_WIP_STAGE);return i<0||i<b?REPAIR_WIP_STAGE:stage;};
const PAY_TYPES=["Diamond deposit","Diamond balance","Setting deposit","Deposit","CAD / Design stage","Production deposit","Progress payment","Final balance","Trade-in credit","Lay-by payment","Other"];
const PAY_METHODS=["Bank transfer","Cash","Card (EFTPOS)","Card (credit)","PayID","Cheque","Gold/Silver trade in","Other"];
const FINDINGS_CAT="Findings";
const PURCHASED_CAT="Purchased Components";
const CENTRE_SET_CAT="Centre Stone Setting";   // legacy — folded into SETTING_CAT (kept for migration)
const SETTING_CAT="Stone Setting";             // unified setting picker (style × size/carat × careful uplift)
const REPAIRS_CAT="Repairs";
const REPAIR_GROUPS=["Cleaning & Polishing","Ring Repairs","Ring Resizing — up to 3mm wide","Ring Resizing — 3mm+ wide","Claw Re-tipping","Band Replacements","Chain Repair","Stone Setting (Repair)","Stone Tightening","Diamond Replacement"];
// ── Stone-setting pricing model ────────────────────────────────────────────
// cost = baseRate(size mm | carat) × styleMultiplier × (careful ? 1+uplift% : 1) × count
// The base rate is the "Prong/Claw" baseline (the mm table = Basic Setting items; carat = baseCaratRate).
// Each style is a multiplier off that base; "careful" is a % uplift for precious/fragile/high-value stones.
// Seeded to reproduce today's pricing: Complex = Basic ×1.25 (mm) / ×1.5 (carat centre).
const SETTING_STYLES_SEED=[
  {id:"prong",  name:"Prong / Claw",         mult:1},
  {id:"dclaw",  name:"Double-claw",          mult:1.25},
  {id:"vclaw",  name:"V-claw / Talon",       mult:1.5},
  {id:"bezel",  name:"Bezel / Rub-over",     mult:1.5},
  {id:"channel",name:"Channel",              mult:1.25},
  {id:"pave",   name:"French pavé",          mult:1.25},
  {id:"pear",   name:"Pear / Marquise claw", mult:1.5},
];
// Split style lists: some styles (bezel, V-claw, pear) are really only centre-stone work, so the
// accent/melee mode and the centre/feature mode each get their own editable list.
const ACCENT_STYLES_SEED=[
  {id:"prong",  name:"Prong / Claw", mult:1},
  {id:"dclaw",  name:"Double-claw",  mult:1.25},
  {id:"channel",name:"Channel",      mult:1.25},
  {id:"pave",   name:"French pavé",  mult:1.25},
];
const CENTRE_STYLES_SEED=[
  {id:"prong",  name:"Prong / Claw",         mult:1},
  {id:"dclaw",  name:"Double-claw",          mult:1.25},
  {id:"vclaw",  name:"V-claw / Talon",       mult:1.5},
  {id:"bezel",  name:"Bezel / Rub-over",     mult:1.5},
  {id:"pear",   name:"Pear / Marquise claw", mult:1.5},
];
// #3 — a sensible starting carat-band schedule scaled off the base $/ct: full rate up to 1ct,
// then tapering (setting a big centre isn't a straight multiple of a small one). Fully editable.
const defaultCaratBands=(base=50)=>{
  const b=Number(base)||50;
  return [
    {upTo:1,   perCt:Math.round(b)},        // 0–1ct  · full rate
    {upTo:2,   perCt:Math.round(b*0.8)},    // 1–2ct  · 80%
    {upTo:null,perCt:Math.round(b*0.6)},    // 2ct+   · 60%
  ];
};
// #5 — a sensible starting pavé/melee volume schedule (per-stone % off once the count is reached).
const defaultVolumeTiers=()=>[
  {minQty:10,offPct:10},   // from 10 stones · 10% off
  {minQty:25,offPct:15},   // from 25 stones · 15% off
  {minQty:50,offPct:20},   // from 50 stones · 20% off
];
const DEFAULT_SETTING_RATES={
  baseCaratRate:50,                  // legacy single per-carat rate; seeds the carat bands
  carefulUpliftPct:35,               // precious / high-value stones
  platinumUpliftPct:20,              // #4 — platinum is harder to set than gold (per-line toggle)
  caratBands:defaultCaratBands(50),  // #3 — marginal carat bands (tapered starting point)
  volumeTiers:defaultVolumeTiers(),  // #5 — per-stone volume discounts (tapered starting point)
  accentStyles:ACCENT_STYLES_SEED,   // smaller / melee stone setting styles
  centreStyles:CENTRE_STYLES_SEED,   // centre / feature stone setting styles
};
// Normalise whatever is stored under K.csr (old {basicPerCt,complexPerCt} OR new settingRates) into the new shape.
const normalizeSettingRates=(raw)=>{
  // Backfill the newer fields (platinum uplift / carat bands / volume tiers) WITHOUT changing
  // existing prices: missing bands become one unbounded band at the saved per-carat rate.
  const withDefaults=(r)=>({
    baseCaratRate:Number(r.baseCaratRate)||50,
    carefulUpliftPct:Number(r.carefulUpliftPct)||0,
    platinumUpliftPct:r.platinumUpliftPct!=null?(Number(r.platinumUpliftPct)||0):20,
    caratBands:Array.isArray(r.caratBands)&&r.caratBands.length?r.caratBands:defaultCaratBands(r.baseCaratRate),
    volumeTiers:Array.isArray(r.volumeTiers)?r.volumeTiers:defaultVolumeTiers(),
    // Split styles: keep new-shape lists if present; otherwise seed BOTH from the old single
    // `styles` list (non-destructive migration — the user then trims each), else the seeds.
    accentStyles:Array.isArray(r.accentStyles)?r.accentStyles:(Array.isArray(r.styles)?r.styles:ACCENT_STYLES_SEED),
    centreStyles:Array.isArray(r.centreStyles)?r.centreStyles:(Array.isArray(r.styles)?r.styles:CENTRE_STYLES_SEED),
  });
  if(raw&&(Array.isArray(raw.accentStyles)||Array.isArray(raw.centreStyles)||Array.isArray(raw.styles)))return withDefaults(raw);
  // migrate from legacy centre rates
  const basic=Number(raw?.basicPerCt)||50;
  const complex=Number(raw?.complexPerCt)||75;
  const complexMult=basic>0?complex/basic:1.5;   // e.g. 75/50 = 1.5
  const styles=SETTING_STYLES_SEED.map(s=>s.id==="prong"?s:({...s,mult:s.mult>=1.5?complexMult:1.25}));
  return withDefaults({baseCaratRate:basic,carefulUpliftPct:35,styles});
};
// Per-stone base rate (Prong/Claw baseline) for a given mm size, read from the base mm table (Basic Setting items).
const settingBaseMmRate=(sizeMm,pricing)=>{
  const items=(pricing||[]).filter(p=>p.category==="Basic Setting");
  if(!items.length)return 0;
  const exact=items.find(p=>Number(p.sizeMm)===Number(sizeMm));
  if(exact)return Number(exact.baseCost)||0;
  // nearest size fallback
  const near=items.slice().sort((a,b)=>Math.abs(a.sizeMm-sizeMm)-Math.abs(b.sizeMm-sizeMm))[0];
  return near?Number(near.baseCost)||0:0;
};
// #3 — carat base via marginal bands: each band prices only the portion of carat weight that
// falls inside it, so a big stone isn't charged as a straight multiple of a small one. A single
// unbounded band reduces to plain (carat × rate). `upTo:null` marks the top, open-ended band.
const settingCaratBase=(carat,rates=DEFAULT_SETTING_RATES)=>{
  const ct=Number(carat)||0;
  if(ct<=0)return 0;
  const raw=Array.isArray(rates.caratBands)&&rates.caratBands.length?rates.caratBands:[{upTo:null,perCt:Number(rates.baseCaratRate)||0}];
  const bands=raw.slice().sort((a,b)=>(a.upTo==null?Infinity:Number(a.upTo))-(b.upTo==null?Infinity:Number(b.upTo)));
  let prev=0,total=0;
  for(const b of bands){
    const cap=b.upTo==null?Infinity:(Number(b.upTo)||0);
    const span=Math.max(0,Math.min(ct,cap)-prev);
    total+=span*(Number(b.perCt)||0);
    prev=cap;
    if(ct<=cap)return total;
  }
  // carat above the highest finite band → charge the remainder at the top band's rate
  const top=bands[bands.length-1];
  return total+(ct-prev)*(Number(top.perCt)||0);
};
// Same walk as settingCaratBase but returns each per-band slice {span,perCt,cost} — used to render
// a live worked example in the Pricing DB that always matches the user's own band figures.
const settingCaratSegments=(carat,rates=DEFAULT_SETTING_RATES)=>{
  const ct=Number(carat)||0;
  if(ct<=0)return [];
  const raw=Array.isArray(rates.caratBands)&&rates.caratBands.length?rates.caratBands:[{upTo:null,perCt:Number(rates.baseCaratRate)||0}];
  const bands=raw.slice().sort((a,b)=>(a.upTo==null?Infinity:Number(a.upTo))-(b.upTo==null?Infinity:Number(b.upTo)));
  let prev=0;const segs=[];
  for(const b of bands){
    const cap=b.upTo==null?Infinity:(Number(b.upTo)||0);
    const span=Math.max(0,Math.min(ct,cap)-prev);
    if(span>0){const perCt=Number(b.perCt)||0;segs.push({span:Math.round(span*100)/100,perCt,cost:span*perCt});}
    prev=cap;
    if(ct<=cap)return segs;
  }
  const top=bands[bands.length-1];const perCt=Number(top.perCt)||0;
  if(ct>prev)segs.push({span:Math.round((ct-prev)*100)/100,perCt,cost:(ct-prev)*perCt});
  return segs;
};
// #5 — volume discount: the highest tier whose minimum quantity is met sets a per-stone % off.
const settingVolumeMult=(count,rates=DEFAULT_SETTING_RATES)=>{
  const tiers=Array.isArray(rates.volumeTiers)?rates.volumeTiers:[];
  if(!tiers.length)return 1;
  const n=Math.max(1,Number(count)||1);
  const hit=tiers.filter(t=>n>=(Number(t.minQty)||1)).sort((a,b)=>(Number(b.minQty)||1)-(Number(a.minQty)||1))[0];
  return hit?Math.max(0,1-(Number(hit.offPct)||0)/100):1;
};
// The one formula. mode: "mm" (per-stone by size) | "carat" (centre/large by carat).
const settingFee=({mode="mm",sizeMm,carat,styleMult=1,careful=false,platinum=false,count=1},rates=DEFAULT_SETTING_RATES,pricing=[])=>{
  const base=mode==="carat"?settingCaratBase(carat,rates):settingBaseMmRate(sizeMm,pricing);
  const up=careful?1+(Number(rates.carefulUpliftPct)||0)/100:1;
  const plat=platinum?1+(Number(rates.platinumUpliftPct)||0)/100:1;
  const n=Math.max(1,Number(count)||1);
  return base*(Number(styleMult)||1)*up*plat*n*settingVolumeMult(n,rates);
};
// Single source of truth for category order — drives BOTH the Pricing Database page tabs
// and the quote-builder pricing picker sidebar, so the two stay identical.
const PCAT=["Metals","Labour","CAD Design",SETTING_CAT,"3D Print & Cast",FINDINGS_CAT,PURCHASED_CAT,"Lab Grown Diamonds | D-E","Natural diamonds G-H SI1","Natural diamonds D-E VS","Accent Stones",REPAIRS_CAT];
// "Accent Stones" is added via its own modal, not browsed as a category, so it's hidden from
// the category navigation in both places.
const NAV_CATS=["All",...PCAT.filter(c=>c!=="Accent Stones")];
// Per-category explanatory text for the "Manual override price" box in the pricing-DB popup.
// Each category can carry its own wording; anything not listed falls back to the generic line.
const MANUAL_OVERRIDE_DEFAULT="The prices in this database are a starting point. Pricing varies between jewellers depending on your suppliers and materials — enter your own label and price to add a custom line to the quote instead.";
const DIAMOND_OVERRIDE_TEXT="Diamond pricing differs between suppliers depending on where you're sourcing from. We've added per-stone pricing for smaller rounds, as they're very commonly used in quoting jewellery. Please review the pricing and adjust it to your supplier's rates, or simply input your supplier price per quote.";
const MANUAL_OVERRIDE_TEXT={
  "Lab Grown Diamonds | D-E":DIAMOND_OVERRIDE_TEXT,
  "Natural diamonds G-H SI1":DIAMOND_OVERRIDE_TEXT,
  "Natural diamonds D-E VS":DIAMOND_OVERRIDE_TEXT,
  "Metals":"Add a manual metal cost. Workshops vary in what they pay. Alloying the metal yourself costs less than buying a pre-cast piece from a caster with taxes included. Feel free to enter your own amount.",
  "Labour":"Add a manual labour cost. Manufacturing rates vary between workshops and individual jewellers, so feel free to enter your own amount.",
  "CAD Design":"Pick the design method that fits the job — CAD, hand sketch, basic design or outsourced CAD. Price by the hour (toggle # and enter hours against the method's rate) or switch to $ for a manual flat price. Add or rename methods any time to match how you work.",
  [FINDINGS_CAT]:"This one's a little tricky, as findings pricing changes often and there are thousands of variants. Butterfly clips, screw-back posts and so on. We recommend adding your commonly used findings with approximate supplier pricing to the database, and entering a manual price for anything more niche.",
  [PURCHASED_CAT]:"Purchased components are items you don't make yourself but add to the piece. For example, a 45cm, 1.2mm gauge 9ct white gold box chain attached to a pendant that you are making. Add your supplier pricing to the database for common components, and enter a manual price for anything one-off.",
  "Basic Setting":"These are average trade prices from across the industry. Every setter charges differently, so depending on who sets your pieces, review these and lock in your own rates or simply quote each piece manually. Basic setting refers to very simple work, such as micropavé on a cast item or a small claw setting.",
  "Complex Setting":"These are average trade prices from across the industry. Every setter charges differently, so depending on who sets your pieces, review these and lock in your own rates or simply quote each piece manually. Complex setting refers to harder work, such as French pavé, channel setting, or setting into solid metal rather than cast pieces.",
  [REPAIRS_CAT]:"These repair prices are based on average rates from Australian jewellery workshops, and everyone charges differently. The figures are generally retail-ready, so they don't necessarily need to be marked up. When quoting repairs, you'll have the option to skip the markup. Review all pricing, add your own job lines, or simply enter pricing manually each time.",
  [CENTRE_SET_CAT]:"The rates above are based on carat weight. Pricing varies between jewellers depending on stone size, stone type, and setting style, so feel free to enter your own price for this centre setting instead.",
  "3D Print & Cast":"Add your own 3D print & cast total instead of the per-piece figures if your supplier charges differently.",
};
const manualOverrideText=cat=>MANUAL_OVERRIDE_TEXT[cat]||MANUAL_OVERRIDE_DEFAULT;
const DIAMOND_CATS=["Lab Grown Diamonds | D-E","Natural diamonds G-H SI1","Natural diamonds D-E VS"];
// Display titles for category nav/headers — the internal category id (used by pricing items,
// filters, quotes) stays unchanged; only the shown title differs.
const CAT_TITLE={
  "CAD Design":"Design & CAD",   // broadened — holds CAD, sketch, basic & outsourced design methods
  "Lab Grown Diamonds | D-E":"(Round) Lab Grown Diamonds: D-E/VS",
  "Natural diamonds G-H SI1":"(Round) Natural Diamonds: G-H/SI",
  "Natural diamonds D-E VS":"(Round) Natural Diamonds: D-E/VS",
};
const catTitle=cat=>CAT_TITLE[cat]||cat;
const NOTE_TYPES=["General note","Client call","Client email","Client visit","Internal update","Approval received"];
// ── Region & currency (per-studio, driven by biz settings via applyRegion) ──────────────────
// Defaults are Australia, so studios created before this feature are unchanged. GST_RATE keeps its
// name (it's the tax rate threaded through the whole pricing model) but is now a LIVE value updated
// when the studio's region loads; fmt/fmtR/fmtDate read the currency symbol/code + locale below.
let GST_RATE=0.10;      // tax rate as a fraction (AU GST 10% → 0.10)
let TAX_LABEL="GST";    // "GST" | "VAT" | "Sales Tax" | "Tax"
let STONE_TAX_INCLUSIVE=false;  // false → tax added on top of the marked-up stone (default); true → marked-up stone price already includes tax
let CUR_SYM="$";        // currency symbol shown before amounts
let CUR_CODE="AUD";     // ISO code shown on documents + used to fetch metal prices
let LOCALE="en-AU";     // number/date locale
let TAX_ID_LABEL="ABN"; // business/tax-number label (ABN / NZBN / Company No. / VAT No. / Tax ID)
const REGION_PRESETS={
  AU:   {label:"Australia (GST 10%, AUD)",      sym:"$", code:"AUD", taxPct:10, taxLabel:"GST", locale:"en-AU", taxId:"ABN"},
  NZ:   {label:"New Zealand (GST 15%, NZD)",    sym:"$", code:"NZD", taxPct:15, taxLabel:"GST", locale:"en-NZ", taxId:"NZBN"},
  GB:   {label:"United Kingdom (VAT 20%, GBP)", sym:"£", code:"GBP", taxPct:20, taxLabel:"VAT", locale:"en-GB", taxId:"Company No."},
  IE:   {label:"Ireland (VAT 23%, EUR)",        sym:"€", code:"EUR", taxPct:23, taxLabel:"VAT", locale:"en-IE", taxId:"VAT No."},
  OTHER:{label:"Other / custom",                sym:"$", code:"",    taxPct:0,  taxLabel:"Tax", locale:"en-AU", taxId:"Tax ID"},
};
// Push a studio's saved region settings into the module-level values above. Missing fields fall
// back to Australia, so a studio created before this feature keeps AUD + 10% GST unchanged.
function applyRegion(b){
  b=b||{};
  CUR_SYM  = b.currencySymbol || "$";
  CUR_CODE = b.currencyCode   || "AUD";
  TAX_LABEL= b.taxLabel       || "GST";
  LOCALE   = b.locale         || "en-AU";
  TAX_ID_LABEL = b.taxIdLabel || "ABN";
  GST_RATE = (b.taxRatePct!=null && b.taxRatePct!=="") ? Number(b.taxRatePct)/100 : 0.10;
  STONE_TAX_INCLUSIVE = !!b.stoneTaxInclusive;   // default off → tax on top of marked-up stones (unchanged for existing studios)
}

// ── Default markup table ──────────────────────────────────────────────────
const DEFAULT_MARKUP_TABLE=[
  {id:"m1",low:1,high:500,multiplier:3},
  {id:"m2",low:500.01,high:1000,multiplier:2.5},
  {id:"m3",low:1000.01,high:1500,multiplier:2.3},
  {id:"m4",low:1500.01,high:2000,multiplier:2.1},
  {id:"m5",low:2000.01,high:3000,multiplier:2},
  {id:"m6",low:3000.01,high:5000,multiplier:1.9},
  {id:"m7",low:5000.01,high:7500,multiplier:1.8},
  {id:"m8",low:7500.01,high:10000,multiplier:1.7},
  {id:"m9",low:10000.01,high:15000,multiplier:1.6},
  {id:"m10",low:15000.01,high:999999,multiplier:1.5},
];

const DEFAULT_NATURAL_STONE_MARKUP=[
  {id:"sn1", low:0,     high:499.99,   multiplier:3.00},
  {id:"sn2", low:500,   high:999.99,   multiplier:3.00},
  {id:"sn3", low:1000,  high:1499.99,  multiplier:2.75},
  {id:"sn4", low:1500,  high:1999.99,  multiplier:2.25},
  {id:"sn5", low:2000,  high:2999.99,  multiplier:2.10},
  {id:"sn6", low:3000,  high:3999.99,  multiplier:2.00},
  {id:"sn7", low:4000,  high:4999.99,  multiplier:1.70},
  {id:"sn8", low:5000,  high:5999.99,  multiplier:1.65},
  {id:"sn9", low:6000,  high:6999.99,  multiplier:1.60},
  {id:"sn10",low:7000,  high:7999.99,  multiplier:1.55},
  {id:"sn11",low:8000,  high:8999.99,  multiplier:1.50},
  {id:"sn12",low:9000,  high:9999.99,  multiplier:1.45},
  {id:"sn13",low:10000, high:10999.99, multiplier:1.40},
  {id:"sn14",low:11000, high:11999.99, multiplier:1.38},
  {id:"sn15",low:12000, high:12999.99, multiplier:1.30},
  {id:"sn16",low:13000, high:13999.99, multiplier:1.27},
  {id:"sn17",low:14000, high:14999.99, multiplier:1.25},
  {id:"sn18",low:15000, high:19999.99, multiplier:1.23},
  {id:"sn19",low:20000, high:1000000,  multiplier:1.20},
];
const DEFAULT_LAB_STONE_MARKUP=[
  {id:"sl1", low:0,     high:499.99,   multiplier:4.25},
  {id:"sl2", low:500,   high:999.99,   multiplier:4.00},
  {id:"sl3", low:1000,  high:1499.99,  multiplier:3.50},
  {id:"sl4", low:1500,  high:1999.99,  multiplier:3.00},
  {id:"sl5", low:2000,  high:2999.99,  multiplier:2.50},
  {id:"sl6", low:3000,  high:3999.99,  multiplier:2.25},
  {id:"sl7", low:4000,  high:4999.99,  multiplier:2.00},
  {id:"sl8", low:5000,  high:5999.99,  multiplier:1.80},
  {id:"sl9", low:6000,  high:6999.99,  multiplier:1.70},
  {id:"sl10",low:7000,  high:7999.99,  multiplier:1.60},
  {id:"sl11",low:8000,  high:8999.99,  multiplier:1.50},
  {id:"sl12",low:9000,  high:9999.99,  multiplier:1.45},
  {id:"sl13",low:10000, high:10999.99, multiplier:1.45},
  {id:"sl14",low:11000, high:11999.99, multiplier:1.40},
  {id:"sl15",low:12000, high:12999.99, multiplier:1.30},
  {id:"sl16",low:13000, high:13999.99, multiplier:1.30},
  {id:"sl17",low:14000, high:14999.99, multiplier:1.30},
  {id:"sl18",low:15000, high:19999.99, multiplier:1.20},
  {id:"sl19",low:20000, high:1000000,  multiplier:1.20},
];
// Trade markup profile — same bracket structure as retail, seeded as a copy so trade
// pricing is safe out of the box; the jeweller lowers these to their wholesale rates.
const DEFAULT_TRADE_MARKUP_TABLE=DEFAULT_MARKUP_TABLE.map(b=>({...b}));
const DEFAULT_TRADE_NATURAL_STONE_MARKUP=DEFAULT_NATURAL_STONE_MARKUP.map(b=>({...b}));
const DEFAULT_TRADE_LAB_STONE_MARKUP=DEFAULT_LAB_STONE_MARKUP.map(b=>({...b}));

// ── Pricing seed ─────────────────────────────────────────────────────────
const SEED_SPOT={gold:105,platinum:148,silver:1.45,updatedAt:"2025-05-01"};
// Gold colour of a metal item — explicit `colour` field wins; legacy items fall back to a name sniff.
// White gold carries a higher casting-house premium (palladium in the master alloy).
const goldColourOf=(item={})=>item.colour||(/\bwhite\b/i.test(item.name||"")?"white":/\b(rose|red|pink)\b/i.test(item.name||"")?"rose":"yellow");
const isWhiteGold=item=>item&&item.metalKey==="gold"&&goldColourOf(item)==="white";
// Casting-house premium % that applies to a metal item, honouring the white-gold uplift.
// If no white premium is set yet, white falls back to the base gold premium (unchanged behaviour).
const premForMetal=(item,sp={})=>{
  if(item.metalKey==="gold")return Number(isWhiteGold(item)?(sp.premGoldWhite??sp.premGold):sp.premGold)||0;
  if(item.metalKey==="platinum")return Number(sp.premPlatinum)||0;
  if(item.metalKey==="silver")return Number(sp.premSilver)||0;
  return 0;
};
// Seed pricing ids that have been retired from the catalogue — stripped from saved data on load
// so they don't linger (and aren't re-added by the missing-seed merge).
const RETIRED_PRICING_IDS=new Set(["p10","cad0","cad1","cad2","cad3","pc1","pc2"]);   // cad0-3: old CAD tiers → hourly (cad_hr); pc1/pc2: flat 3D-print/casting fees → size tiers
// Built-in (seed) items the user has deleted. Loaded from storage at startup; the missing-seed
// merge skips these so a deleted built-in item doesn't reappear. (SEED_PRICING_IDS defined after the seed array.)
const _deletedSeedIds=new Set();
const SEED_PRICING=[
  {id:"p1",category:"Metals",name:"9ct yellow gold",unit:"g",baseCost:39.38,metalKey:"gold",purity:0.375,colour:"yellow"},
  {id:"p2",category:"Metals",name:"18ct yellow gold",unit:"g",baseCost:78.75,metalKey:"gold",purity:0.75,colour:"yellow"},
  {id:"p3",category:"Metals",name:"18ct white gold",unit:"g",baseCost:78.75,metalKey:"gold",purity:0.75,colour:"white"},
  {id:"p4",category:"Metals",name:"18ct rose gold",unit:"g",baseCost:78.75,metalKey:"gold",purity:0.75,colour:"rose"},
  {id:"p5",category:"Metals",name:"9ct white gold",unit:"g",baseCost:39.38,metalKey:"gold",purity:0.375,colour:"white"},
  {id:"p5b",category:"Metals",name:"9ct rose gold",unit:"g",baseCost:39.38,metalKey:"gold",purity:0.375,colour:"rose"},
  {id:"p5c",category:"Metals",name:"14ct yellow gold",unit:"g",baseCost:61.43,metalKey:"gold",purity:0.585,colour:"yellow"},
  {id:"p5d",category:"Metals",name:"14ct white gold",unit:"g",baseCost:61.43,metalKey:"gold",purity:0.585,colour:"white"},
  {id:"p5e",category:"Metals",name:"14ct rose gold",unit:"g",baseCost:61.43,metalKey:"gold",purity:0.585,colour:"rose"},
  {id:"p6",category:"Metals",name:"Platinum 950",unit:"g",baseCost:140.60,metalKey:"platinum",purity:0.95},
  {id:"p7",category:"Metals",name:"Silver 925",unit:"g",baseCost:1.34,metalKey:"silver",purity:0.925},
  {id:"p8",category:"Labour",name:"Bench Labour (Casting Assembly)",unit:"hr",baseCost:70},

  // Findings & Purchased Components: intentionally NO seed items — these vary hugely per studio,
  // so fresh studios start empty and add their own. Categories still appear (listed in PCAT) with
  // their guidance blurbs. (Existing studios keep any items they already have — not retired here.)
  // ── 3D Printing & Casting ─────────────────────────────────────────────────
  {id:"print_s",category:"3D Print & Cast",name:"Small 3D print (studs, small items)",unit:"piece",baseCost:30},
  {id:"print_m",category:"3D Print & Cast",name:"Medium 3D print (ring shanks)",unit:"piece",baseCost:75},
  {id:"print_l",category:"3D Print & Cast",name:"Large 3D print (bangles)",unit:"piece",baseCost:150},
  {id:"cast_s",category:"3D Print & Cast",name:"Small casting",unit:"piece",baseCost:10},
  {id:"cast_m",category:"3D Print & Cast",name:"Medium casting",unit:"piece",baseCost:20},
  {id:"cast_l",category:"3D Print & Cast",name:"Large casting",unit:"piece",baseCost:30},
  // ── Design & CAD ──────────────────────────────────────────────────────────
  // Each design method is priced by the hour (set the rate here) or as a manual flat price at
  // quote time via the #/$ toggle. Add/rename/remove methods freely in the Pricing Database.
  {id:"cad_hr",category:"CAD Design",name:"CAD design",unit:"hr",baseCost:90},
  {id:"dsg_sketch",category:"CAD Design",name:"Hand sketch",unit:"hr",baseCost:60},
  {id:"dsg_basic",category:"CAD Design",name:"Basic design",unit:"hr",baseCost:70},
  {id:"dsg_outsourced",category:"CAD Design",name:"Outsourced CAD",unit:"hr",baseCost:50},
  // ── Lab-grown accent diamonds D-E VS ─────────────────────────────────────
  {id:"ld01",category:"Lab Grown Diamonds | D-E",name:"0.8mm",unit:"stone",baseCost:0.81,sizeMm:0.8,caratWeight:0.002,pricePerCarat:405.00},
  {id:"ld02",category:"Lab Grown Diamonds | D-E",name:"0.9mm",unit:"stone",baseCost:0.92,sizeMm:0.9,caratWeight:0.003,pricePerCarat:306.67},
  {id:"ld03",category:"Lab Grown Diamonds | D-E",name:"1.0mm",unit:"stone",baseCost:1.46,sizeMm:1.0,caratWeight:0.004,pricePerCarat:365.00},
  {id:"ld04",category:"Lab Grown Diamonds | D-E",name:"1.1mm",unit:"stone",baseCost:1.32,sizeMm:1.1,caratWeight:0.005,pricePerCarat:264.00},
  {id:"ld05",category:"Lab Grown Diamonds | D-E",name:"1.2mm",unit:"stone",baseCost:1.27,sizeMm:1.2,caratWeight:0.007,pricePerCarat:181.43},
  {id:"ld06",category:"Lab Grown Diamonds | D-E",name:"1.3mm",unit:"stone",baseCost:1.37,sizeMm:1.3,caratWeight:0.009,pricePerCarat:152.22},
  {id:"ld07",category:"Lab Grown Diamonds | D-E",name:"1.4mm",unit:"stone",baseCost:1.36,sizeMm:1.4,caratWeight:0.011,pricePerCarat:123.64},
  {id:"ld08",category:"Lab Grown Diamonds | D-E",name:"1.5mm",unit:"stone",baseCost:2.18,sizeMm:1.5,caratWeight:0.013,pricePerCarat:167.69},
  {id:"ld09",category:"Lab Grown Diamonds | D-E",name:"1.6mm",unit:"stone",baseCost:2.09,sizeMm:1.6,caratWeight:0.016,pricePerCarat:130.63},
  {id:"ld10",category:"Lab Grown Diamonds | D-E",name:"1.7mm",unit:"stone",baseCost:2.45,sizeMm:1.7,caratWeight:0.019,pricePerCarat:128.95},
  {id:"ld11",category:"Lab Grown Diamonds | D-E",name:"1.8mm",unit:"stone",baseCost:2.72,sizeMm:1.8,caratWeight:0.023,pricePerCarat:118.26},
  {id:"ld12",category:"Lab Grown Diamonds | D-E",name:"1.9mm",unit:"stone",baseCost:2.52,sizeMm:1.9,caratWeight:0.027,pricePerCarat:93.33},
  {id:"ld13",category:"Lab Grown Diamonds | D-E",name:"2.0mm",unit:"stone",baseCost:3.85,sizeMm:2.0,caratWeight:0.031,pricePerCarat:124.19},
  {id:"ld14",category:"Lab Grown Diamonds | D-E",name:"2.1mm",unit:"stone",baseCost:2.89,sizeMm:2.1,caratWeight:0.036,pricePerCarat:80.28},
  {id:"ld15",category:"Lab Grown Diamonds | D-E",name:"2.2mm",unit:"stone",baseCost:3.35,sizeMm:2.2,caratWeight:0.042,pricePerCarat:79.76},
  {id:"ld16",category:"Lab Grown Diamonds | D-E",name:"2.3mm",unit:"stone",baseCost:3.88,sizeMm:2.3,caratWeight:0.047,pricePerCarat:82.55},
  {id:"ld17",category:"Lab Grown Diamonds | D-E",name:"2.4mm",unit:"stone",baseCost:4.22,sizeMm:2.4,caratWeight:0.054,pricePerCarat:78.15},
  {id:"ld18",category:"Lab Grown Diamonds | D-E",name:"2.5mm",unit:"stone",baseCost:4.49,sizeMm:2.5,caratWeight:0.061,pricePerCarat:73.61},
  {id:"ld19",category:"Lab Grown Diamonds | D-E",name:"2.6mm",unit:"stone",baseCost:4.46,sizeMm:2.6,caratWeight:0.069,pricePerCarat:64.64},
  {id:"ld20",category:"Lab Grown Diamonds | D-E",name:"2.7mm",unit:"stone",baseCost:5.43,sizeMm:2.7,caratWeight:0.077,pricePerCarat:70.52},
  {id:"ld21",category:"Lab Grown Diamonds | D-E",name:"2.8mm",unit:"stone",baseCost:6.11,sizeMm:2.8,caratWeight:0.086,pricePerCarat:71.05},
  {id:"ld22",category:"Lab Grown Diamonds | D-E",name:"2.9mm",unit:"stone",baseCost:6.72,sizeMm:2.9,caratWeight:0.095,pricePerCarat:70.74},
  {id:"ld23",category:"Lab Grown Diamonds | D-E",name:"3.0mm",unit:"stone",baseCost:7.36,sizeMm:3.0,caratWeight:0.105,pricePerCarat:70.10},
  {id:"ld24",category:"Lab Grown Diamonds | D-E",name:"3.1mm",unit:"stone",baseCost:11.36,sizeMm:3.1,caratWeight:0.116,pricePerCarat:97.93},
  {id:"ld25",category:"Lab Grown Diamonds | D-E",name:"3.2mm",unit:"stone",baseCost:10.40,sizeMm:3.2,caratWeight:0.128,pricePerCarat:81.25},
  {id:"ld26",category:"Lab Grown Diamonds | D-E",name:"3.3mm",unit:"stone",baseCost:10.00,sizeMm:3.3,caratWeight:0.140,pricePerCarat:71.43},
  {id:"ld27",category:"Lab Grown Diamonds | D-E",name:"3.4mm",unit:"stone",baseCost:11.80,sizeMm:3.4,caratWeight:0.153,pricePerCarat:77.12},
  {id:"ld28",category:"Lab Grown Diamonds | D-E",name:"3.5mm",unit:"stone",baseCost:16.00,sizeMm:3.5,caratWeight:0.167,pricePerCarat:95.81},
  {id:"ld29",category:"Lab Grown Diamonds | D-E",name:"3.6mm",unit:"stone",baseCost:20.00,sizeMm:3.6,caratWeight:0.182,pricePerCarat:109.89},
  {id:"ld30",category:"Lab Grown Diamonds | D-E",name:"3.7mm",unit:"stone",baseCost:22.00,sizeMm:3.7,caratWeight:0.198,pricePerCarat:111.11},
  {id:"ld31",category:"Lab Grown Diamonds | D-E",name:"3.8mm",unit:"stone",baseCost:26.00,sizeMm:3.8,caratWeight:0.214,pricePerCarat:121.50},
  {id:"ld32",category:"Lab Grown Diamonds | D-E",name:"3.9mm",unit:"stone",baseCost:28.00,sizeMm:3.9,caratWeight:0.231,pricePerCarat:121.21},
  {id:"ld33",category:"Lab Grown Diamonds | D-E",name:"4.0mm",unit:"stone",baseCost:30.00,sizeMm:4.0,caratWeight:0.250,pricePerCarat:120.00},
  // ── Natural diamonds G-H SI1 ──────────────────────────────────────────────
  {id:"ng01",category:"Natural diamonds G-H SI1",name:"0.8mm",unit:"stone",baseCost:1.42,sizeMm:0.8,caratWeight:0.002,pricePerCarat:710.00},
  {id:"ng02",category:"Natural diamonds G-H SI1",name:"0.9mm",unit:"stone",baseCost:2.02,sizeMm:0.9,caratWeight:0.003,pricePerCarat:673.33},
  {id:"ng03",category:"Natural diamonds G-H SI1",name:"1.0mm",unit:"stone",baseCost:2.67,sizeMm:1.0,caratWeight:0.004,pricePerCarat:667.50},
  {id:"ng04",category:"Natural diamonds G-H SI1",name:"1.1mm",unit:"stone",baseCost:3.38,sizeMm:1.1,caratWeight:0.005,pricePerCarat:676.00},
  {id:"ng05",category:"Natural diamonds G-H SI1",name:"1.2mm",unit:"stone",baseCost:4.20,sizeMm:1.2,caratWeight:0.007,pricePerCarat:600.00},
  {id:"ng06",category:"Natural diamonds G-H SI1",name:"1.3mm",unit:"stone",baseCost:4.67,sizeMm:1.3,caratWeight:0.009,pricePerCarat:518.89},
  {id:"ng07",category:"Natural diamonds G-H SI1",name:"1.4mm",unit:"stone",baseCost:5.16,sizeMm:1.4,caratWeight:0.011,pricePerCarat:469.09},
  {id:"ng08",category:"Natural diamonds G-H SI1",name:"1.5mm",unit:"stone",baseCost:7.41,sizeMm:1.5,caratWeight:0.013,pricePerCarat:570.00},
  {id:"ng09",category:"Natural diamonds G-H SI1",name:"1.6mm",unit:"stone",baseCost:7.20,sizeMm:1.6,caratWeight:0.016,pricePerCarat:450.00},
  {id:"ng10",category:"Natural diamonds G-H SI1",name:"1.7mm",unit:"stone",baseCost:8.70,sizeMm:1.7,caratWeight:0.019,pricePerCarat:457.89},
  {id:"ng11",category:"Natural diamonds G-H SI1",name:"1.8mm",unit:"stone",baseCost:12.50,sizeMm:1.8,caratWeight:0.023,pricePerCarat:543.48},
  {id:"ng12",category:"Natural diamonds G-H SI1",name:"1.9mm",unit:"stone",baseCost:14.50,sizeMm:1.9,caratWeight:0.027,pricePerCarat:537.04},
  {id:"ng13",category:"Natural diamonds G-H SI1",name:"2.0mm",unit:"stone",baseCost:18.25,sizeMm:2.0,caratWeight:0.031,pricePerCarat:588.71},
  {id:"ng14",category:"Natural diamonds G-H SI1",name:"2.1mm",unit:"stone",baseCost:19.90,sizeMm:2.1,caratWeight:0.036,pricePerCarat:552.78},
  {id:"ng15",category:"Natural diamonds G-H SI1",name:"2.2mm",unit:"stone",baseCost:24.15,sizeMm:2.2,caratWeight:0.042,pricePerCarat:575.00},
  {id:"ng16",category:"Natural diamonds G-H SI1",name:"2.3mm",unit:"stone",baseCost:31.15,sizeMm:2.3,caratWeight:0.047,pricePerCarat:662.77},
  {id:"ng17",category:"Natural diamonds G-H SI1",name:"2.4mm",unit:"stone",baseCost:35.07,sizeMm:2.4,caratWeight:0.054,pricePerCarat:649.44},
  {id:"ng18",category:"Natural diamonds G-H SI1",name:"2.5mm",unit:"stone",baseCost:40.38,sizeMm:2.5,caratWeight:0.061,pricePerCarat:661.97},
  {id:"ng19",category:"Natural diamonds G-H SI1",name:"2.6mm",unit:"stone",baseCost:44.65,sizeMm:2.6,caratWeight:0.069,pricePerCarat:647.10},
  {id:"ng20",category:"Natural diamonds G-H SI1",name:"2.7mm",unit:"stone",baseCost:54.65,sizeMm:2.7,caratWeight:0.077,pricePerCarat:709.74},
  {id:"ng21",category:"Natural diamonds G-H SI1",name:"2.8mm",unit:"stone",baseCost:61.88,sizeMm:2.8,caratWeight:0.086,pricePerCarat:719.53},
  {id:"ng22",category:"Natural diamonds G-H SI1",name:"2.9mm",unit:"stone",baseCost:70.44,sizeMm:2.9,caratWeight:0.095,pricePerCarat:741.47},
  {id:"ng23",category:"Natural diamonds G-H SI1",name:"3.0mm",unit:"stone",baseCost:79.50,sizeMm:3.0,caratWeight:0.105,pricePerCarat:757.14},
  {id:"ng24",category:"Natural diamonds G-H SI1",name:"3.1mm",unit:"stone",baseCost:86.79,sizeMm:3.1,caratWeight:0.116,pricePerCarat:748.19},
  {id:"ng25",category:"Natural diamonds G-H SI1",name:"3.2mm",unit:"stone",baseCost:98.80,sizeMm:3.2,caratWeight:0.128,pricePerCarat:771.88},
  {id:"ng26",category:"Natural diamonds G-H SI1",name:"3.3mm",unit:"stone",baseCost:105.60,sizeMm:3.3,caratWeight:0.140,pricePerCarat:754.29},
  {id:"ng27",category:"Natural diamonds G-H SI1",name:"3.4mm",unit:"stone",baseCost:113.00,sizeMm:3.4,caratWeight:0.153,pricePerCarat:738.56},
  {id:"ng28",category:"Natural diamonds G-H SI1",name:"3.5mm",unit:"stone",baseCost:121.60,sizeMm:3.5,caratWeight:0.167,pricePerCarat:728.14},
  {id:"ng29",category:"Natural diamonds G-H SI1",name:"3.6mm",unit:"stone",baseCost:132.50,sizeMm:3.6,caratWeight:0.182,pricePerCarat:728.02},
  {id:"ng30",category:"Natural diamonds G-H SI1",name:"3.7mm",unit:"stone",baseCost:164.50,sizeMm:3.7,caratWeight:0.198,pricePerCarat:830.81},
  {id:"ng31",category:"Natural diamonds G-H SI1",name:"3.8mm",unit:"stone",baseCost:182.50,sizeMm:3.8,caratWeight:0.214,pricePerCarat:852.80},
  {id:"ng32",category:"Natural diamonds G-H SI1",name:"3.9mm",unit:"stone",baseCost:210.00,sizeMm:3.9,caratWeight:0.231,pricePerCarat:909.09},
  {id:"ng33",category:"Natural diamonds G-H SI1",name:"4.0mm",unit:"stone",baseCost:222.50,sizeMm:4.0,caratWeight:0.250,pricePerCarat:890.00},
  // ── Natural diamonds D-E VS ───────────────────────────────────────────────
  {id:"nd01",category:"Natural diamonds D-E VS",name:"0.8mm",unit:"stone",baseCost:1.88,sizeMm:0.8,caratWeight:0.002,pricePerCarat:940.00},
  {id:"nd02",category:"Natural diamonds D-E VS",name:"0.9mm",unit:"stone",baseCost:2.67,sizeMm:0.9,caratWeight:0.003,pricePerCarat:890.00},
  {id:"nd03",category:"Natural diamonds D-E VS",name:"1.0mm",unit:"stone",baseCost:3.54,sizeMm:1.0,caratWeight:0.004,pricePerCarat:885.00},
  {id:"nd04",category:"Natural diamonds D-E VS",name:"1.1mm",unit:"stone",baseCost:4.48,sizeMm:1.1,caratWeight:0.005,pricePerCarat:896.00},
  {id:"nd05",category:"Natural diamonds D-E VS",name:"1.2mm",unit:"stone",baseCost:4.85,sizeMm:1.2,caratWeight:0.007,pricePerCarat:692.86},
  {id:"nd06",category:"Natural diamonds D-E VS",name:"1.3mm",unit:"stone",baseCost:5.70,sizeMm:1.3,caratWeight:0.009,pricePerCarat:633.33},
  {id:"nd07",category:"Natural diamonds D-E VS",name:"1.4mm",unit:"stone",baseCost:6.80,sizeMm:1.4,caratWeight:0.011,pricePerCarat:618.18},
  {id:"nd08",category:"Natural diamonds D-E VS",name:"1.5mm",unit:"stone",baseCost:9.26,sizeMm:1.5,caratWeight:0.013,pricePerCarat:712.31},
  {id:"nd09",category:"Natural diamonds D-E VS",name:"1.6mm",unit:"stone",baseCost:9.43,sizeMm:1.6,caratWeight:0.016,pricePerCarat:589.38},
  {id:"nd10",category:"Natural diamonds D-E VS",name:"1.7mm",unit:"stone",baseCost:11.04,sizeMm:1.7,caratWeight:0.019,pricePerCarat:581.05},
  {id:"nd11",category:"Natural diamonds D-E VS",name:"1.8mm",unit:"stone",baseCost:15.00,sizeMm:1.8,caratWeight:0.023,pricePerCarat:652.17},
  {id:"nd12",category:"Natural diamonds D-E VS",name:"1.9mm",unit:"stone",baseCost:15.97,sizeMm:1.9,caratWeight:0.027,pricePerCarat:591.48},
  {id:"nd13",category:"Natural diamonds D-E VS",name:"2.0mm",unit:"stone",baseCost:20.00,sizeMm:2.0,caratWeight:0.031,pricePerCarat:645.16},
  {id:"nd14",category:"Natural diamonds D-E VS",name:"2.1mm",unit:"stone",baseCost:25.00,sizeMm:2.1,caratWeight:0.036,pricePerCarat:694.44},
  {id:"nd15",category:"Natural diamonds D-E VS",name:"2.2mm",unit:"stone",baseCost:28.18,sizeMm:2.2,caratWeight:0.042,pricePerCarat:670.95},
  {id:"nd16",category:"Natural diamonds D-E VS",name:"2.3mm",unit:"stone",baseCost:38.20,sizeMm:2.3,caratWeight:0.047,pricePerCarat:812.77},
  {id:"nd17",category:"Natural diamonds D-E VS",name:"2.4mm",unit:"stone",baseCost:39.50,sizeMm:2.4,caratWeight:0.054,pricePerCarat:731.48},
  {id:"nd18",category:"Natural diamonds D-E VS",name:"2.5mm",unit:"stone",baseCost:46.50,sizeMm:2.5,caratWeight:0.061,pricePerCarat:762.30},
  {id:"nd19",category:"Natural diamonds D-E VS",name:"2.6mm",unit:"stone",baseCost:50.00,sizeMm:2.6,caratWeight:0.069,pricePerCarat:724.64},
  {id:"nd20",category:"Natural diamonds D-E VS",name:"2.7mm",unit:"stone",baseCost:64.50,sizeMm:2.7,caratWeight:0.077,pricePerCarat:837.66},
  {id:"nd21",category:"Natural diamonds D-E VS",name:"2.8mm",unit:"stone",baseCost:72.50,sizeMm:2.8,caratWeight:0.086,pricePerCarat:843.02},
  {id:"nd22",category:"Natural diamonds D-E VS",name:"2.9mm",unit:"stone",baseCost:85.50,sizeMm:2.9,caratWeight:0.095,pricePerCarat:900.00},
  {id:"nd23",category:"Natural diamonds D-E VS",name:"3.0mm",unit:"stone",baseCost:93.50,sizeMm:3.0,caratWeight:0.105,pricePerCarat:890.48},
  {id:"nd24",category:"Natural diamonds D-E VS",name:"3.1mm",unit:"stone",baseCost:103.50,sizeMm:3.1,caratWeight:0.116,pricePerCarat:892.24},
  {id:"nd25",category:"Natural diamonds D-E VS",name:"3.2mm",unit:"stone",baseCost:117.50,sizeMm:3.2,caratWeight:0.128,pricePerCarat:917.97},
  {id:"nd26",category:"Natural diamonds D-E VS",name:"3.3mm",unit:"stone",baseCost:127.50,sizeMm:3.3,caratWeight:0.140,pricePerCarat:910.71},
  {id:"nd27",category:"Natural diamonds D-E VS",name:"3.4mm",unit:"stone",baseCost:154.00,sizeMm:3.4,caratWeight:0.153,pricePerCarat:1006.54},
  {id:"nd28",category:"Natural diamonds D-E VS",name:"3.5mm",unit:"stone",baseCost:167.50,sizeMm:3.5,caratWeight:0.167,pricePerCarat:1002.99},
  {id:"nd29",category:"Natural diamonds D-E VS",name:"3.6mm",unit:"stone",baseCost:181.00,sizeMm:3.6,caratWeight:0.182,pricePerCarat:994.51},
  {id:"nd30",category:"Natural diamonds D-E VS",name:"3.7mm",unit:"stone",baseCost:216.00,sizeMm:3.7,caratWeight:0.198,pricePerCarat:1090.91},
  {id:"nd31",category:"Natural diamonds D-E VS",name:"3.8mm",unit:"stone",baseCost:249.00,sizeMm:3.8,caratWeight:0.214,pricePerCarat:1163.55},
  {id:"nd32",category:"Natural diamonds D-E VS",name:"3.9mm",unit:"stone",baseCost:275.00,sizeMm:3.9,caratWeight:0.231,pricePerCarat:1190.48},
  {id:"nd33",category:"Natural diamonds D-E VS",name:"4.0mm",unit:"stone",baseCost:300.00,sizeMm:4.0,caratWeight:0.250,pricePerCarat:1200.00},
  // ── Basic Setting — labour cost per stone by size ────────────────────────
  // Fixed setting fee regardless of stone type (lab or natural)
  {id:"brs01",category:"Basic Setting",name:"0.7mm",unit:"stone",baseCost:3.50,sizeMm:0.7,caratWeight:0.001},
  {id:"brs02",category:"Basic Setting",name:"0.8mm",unit:"stone",baseCost:4.00,sizeMm:0.8,caratWeight:0.002},
  {id:"brs03",category:"Basic Setting",name:"0.9mm",unit:"stone",baseCost:4.50,sizeMm:0.9,caratWeight:0.003},
  {id:"brs04",category:"Basic Setting",name:"1.0mm",unit:"stone",baseCost:5.00,sizeMm:1.0,caratWeight:0.004},
  {id:"brs05",category:"Basic Setting",name:"1.1mm",unit:"stone",baseCost:5.50,sizeMm:1.1,caratWeight:0.005},
  {id:"brs06",category:"Basic Setting",name:"1.2mm",unit:"stone",baseCost:6.00,sizeMm:1.2,caratWeight:0.007},
  {id:"brs07",category:"Basic Setting",name:"1.3mm",unit:"stone",baseCost:6.50,sizeMm:1.3,caratWeight:0.009},
  {id:"brs08",category:"Basic Setting",name:"1.4mm",unit:"stone",baseCost:7.00,sizeMm:1.4,caratWeight:0.011},
  {id:"brs09",category:"Basic Setting",name:"1.5mm",unit:"stone",baseCost:7.50,sizeMm:1.5,caratWeight:0.013},
  {id:"brs10",category:"Basic Setting",name:"1.6mm",unit:"stone",baseCost:8.00,sizeMm:1.6,caratWeight:0.016},
  {id:"brs11",category:"Basic Setting",name:"1.7mm",unit:"stone",baseCost:8.50,sizeMm:1.7,caratWeight:0.019},
  {id:"brs12",category:"Basic Setting",name:"1.8mm",unit:"stone",baseCost:9.00,sizeMm:1.8,caratWeight:0.023},
  {id:"brs13",category:"Basic Setting",name:"1.9mm",unit:"stone",baseCost:9.50,sizeMm:1.9,caratWeight:0.027},
  {id:"brs14",category:"Basic Setting",name:"2.0mm",unit:"stone",baseCost:10.00,sizeMm:2.0,caratWeight:0.031},
  {id:"brs15",category:"Basic Setting",name:"2.1mm",unit:"stone",baseCost:10.50,sizeMm:2.1,caratWeight:0.036},
  {id:"brs16",category:"Basic Setting",name:"2.2mm",unit:"stone",baseCost:11.00,sizeMm:2.2,caratWeight:0.042},
  {id:"brs17",category:"Basic Setting",name:"2.3mm",unit:"stone",baseCost:11.50,sizeMm:2.3,caratWeight:0.047},
  {id:"brs18",category:"Basic Setting",name:"2.4mm",unit:"stone",baseCost:12.00,sizeMm:2.4,caratWeight:0.054},
  {id:"brs19",category:"Basic Setting",name:"2.5mm",unit:"stone",baseCost:12.50,sizeMm:2.5,caratWeight:0.061},
  {id:"brs20",category:"Basic Setting",name:"2.6mm",unit:"stone",baseCost:13.00,sizeMm:2.6,caratWeight:0.069},
  {id:"brs21",category:"Basic Setting",name:"2.7mm",unit:"stone",baseCost:13.50,sizeMm:2.7,caratWeight:0.077},
  {id:"brs22",category:"Basic Setting",name:"2.8mm",unit:"stone",baseCost:14.00,sizeMm:2.8,caratWeight:0.086},
  {id:"brs23",category:"Basic Setting",name:"2.9mm",unit:"stone",baseCost:14.50,sizeMm:2.9,caratWeight:0.095},
  {id:"brs24",category:"Basic Setting",name:"3.0mm",unit:"stone",baseCost:15.00,sizeMm:3.0,caratWeight:0.105},
  {id:"brs25",category:"Basic Setting",name:"3.1mm",unit:"stone",baseCost:15.50,sizeMm:3.1,caratWeight:0.116},
  {id:"brs26",category:"Basic Setting",name:"3.2mm",unit:"stone",baseCost:16.00,sizeMm:3.2,caratWeight:0.128},
  {id:"brs27",category:"Basic Setting",name:"3.3mm",unit:"stone",baseCost:16.50,sizeMm:3.3,caratWeight:0.140},
  {id:"brs28",category:"Basic Setting",name:"3.4mm",unit:"stone",baseCost:17.00,sizeMm:3.4,caratWeight:0.153},
  {id:"brs29",category:"Basic Setting",name:"3.5mm",unit:"stone",baseCost:17.50,sizeMm:3.5,caratWeight:0.167},
  {id:"brs30",category:"Basic Setting",name:"3.6mm",unit:"stone",baseCost:18.00,sizeMm:3.6,caratWeight:0.182},
  {id:"brs31",category:"Basic Setting",name:"3.7mm",unit:"stone",baseCost:18.50,sizeMm:3.7,caratWeight:0.198},
  {id:"brs32",category:"Basic Setting",name:"3.8mm",unit:"stone",baseCost:19.00,sizeMm:3.8,caratWeight:0.214},
  {id:"brs33",category:"Basic Setting",name:"3.9mm",unit:"stone",baseCost:19.50,sizeMm:3.9,caratWeight:0.231},
  {id:"brs34",category:"Basic Setting",name:"4.0mm",unit:"stone",baseCost:20.00,sizeMm:4.0,caratWeight:0.250},
  {id:"brs35",category:"Basic Setting",name:"4.1mm",unit:"stone",baseCost:20.50,sizeMm:4.1,caratWeight:0.269},
  {id:"brs36",category:"Basic Setting",name:"4.2mm",unit:"stone",baseCost:21.00,sizeMm:4.2,caratWeight:0.289},
  {id:"brs37",category:"Basic Setting",name:"4.3mm",unit:"stone",baseCost:21.50,sizeMm:4.3,caratWeight:0.310},
  {id:"brs38",category:"Basic Setting",name:"4.4mm",unit:"stone",baseCost:22.00,sizeMm:4.4,caratWeight:0.332},
  {id:"brs39",category:"Basic Setting",name:"4.5mm",unit:"stone",baseCost:22.50,sizeMm:4.5,caratWeight:0.355},
  {id:"brs40",category:"Basic Setting",name:"4.6mm",unit:"stone",baseCost:23.00,sizeMm:4.6,caratWeight:0.380},
  {id:"brs41",category:"Basic Setting",name:"4.7mm",unit:"stone",baseCost:23.50,sizeMm:4.7,caratWeight:0.405},
  {id:"brs42",category:"Basic Setting",name:"4.8mm",unit:"stone",baseCost:24.00,sizeMm:4.8,caratWeight:0.431},
  {id:"brs43",category:"Basic Setting",name:"4.9mm",unit:"stone",baseCost:24.50,sizeMm:4.9,caratWeight:0.459},
  {id:"brs44",category:"Basic Setting",name:"5.0mm",unit:"stone",baseCost:25.00,sizeMm:5.0,caratWeight:0.488},
  {id:"brs45",category:"Basic Setting",name:"5.1mm",unit:"stone",baseCost:25.50,sizeMm:5.1,caratWeight:0.517},
  {id:"brs46",category:"Basic Setting",name:"5.2mm",unit:"stone",baseCost:26.00,sizeMm:5.2,caratWeight:0.548},
  {id:"brs47",category:"Basic Setting",name:"5.3mm",unit:"stone",baseCost:26.50,sizeMm:5.3,caratWeight:0.581},
  {id:"brs48",category:"Basic Setting",name:"5.4mm",unit:"stone",baseCost:27.00,sizeMm:5.4,caratWeight:0.614},
  {id:"brs49",category:"Basic Setting",name:"5.5mm",unit:"stone",baseCost:27.50,sizeMm:5.5,caratWeight:0.649},
  {id:"brs50",category:"Basic Setting",name:"5.6mm",unit:"stone",baseCost:28.00,sizeMm:5.6,caratWeight:0.685},
  {id:"brs51",category:"Basic Setting",name:"5.7mm",unit:"stone",baseCost:28.50,sizeMm:5.7,caratWeight:0.722},
  {id:"brs52",category:"Basic Setting",name:"5.8mm",unit:"stone",baseCost:29.00,sizeMm:5.8,caratWeight:0.761},
  {id:"brs53",category:"Basic Setting",name:"5.9mm",unit:"stone",baseCost:29.50,sizeMm:5.9,caratWeight:0.801},
  {id:"brs54",category:"Basic Setting",name:"6.0mm",unit:"stone",baseCost:30.00,sizeMm:6.0,caratWeight:0.842},
  {id:"brs55",category:"Basic Setting",name:"6.1mm",unit:"stone",baseCost:30.50,sizeMm:6.1,caratWeight:0.885},
  {id:"brs56",category:"Basic Setting",name:"6.2mm",unit:"stone",baseCost:31.00,sizeMm:6.2,caratWeight:0.929},
  {id:"brs57",category:"Basic Setting",name:"6.3mm",unit:"stone",baseCost:31.50,sizeMm:6.3,caratWeight:0.975},
  {id:"brs58",category:"Basic Setting",name:"6.4mm",unit:"stone",baseCost:32.00,sizeMm:6.4,caratWeight:1.022},
  {id:"brs59",category:"Basic Setting",name:"6.5mm",unit:"stone",baseCost:32.50,sizeMm:6.5,caratWeight:1.071},
  {id:"brs60",category:"Basic Setting",name:"6.6mm",unit:"stone",baseCost:33.00,sizeMm:6.6,caratWeight:1.121},
  {id:"brs61",category:"Basic Setting",name:"6.7mm",unit:"stone",baseCost:33.50,sizeMm:6.7,caratWeight:1.173},
  {id:"brs62",category:"Basic Setting",name:"6.8mm",unit:"stone",baseCost:34.00,sizeMm:6.8,caratWeight:1.226},
  {id:"brs63",category:"Basic Setting",name:"6.9mm",unit:"stone",baseCost:34.50,sizeMm:6.9,caratWeight:1.281},
  {id:"brs64",category:"Basic Setting",name:"7.0mm",unit:"stone",baseCost:35.00,sizeMm:7.0,caratWeight:1.338},
  // ── Complex Setting (French Pavé / Channel / Bezel) — labour cost per stone ─
  {id:"css01",category:"Complex Setting",name:"0.7mm",unit:"stone",baseCost:4.38,sizeMm:0.7,caratWeight:0.001},
  {id:"css02",category:"Complex Setting",name:"0.8mm",unit:"stone",baseCost:5.00,sizeMm:0.8,caratWeight:0.002},
  {id:"css03",category:"Complex Setting",name:"0.9mm",unit:"stone",baseCost:5.63,sizeMm:0.9,caratWeight:0.003},
  {id:"css04",category:"Complex Setting",name:"1.0mm",unit:"stone",baseCost:6.25,sizeMm:1.0,caratWeight:0.004},
  {id:"css05",category:"Complex Setting",name:"1.1mm",unit:"stone",baseCost:6.88,sizeMm:1.1,caratWeight:0.005},
  {id:"css06",category:"Complex Setting",name:"1.2mm",unit:"stone",baseCost:7.50,sizeMm:1.2,caratWeight:0.007},
  {id:"css07",category:"Complex Setting",name:"1.3mm",unit:"stone",baseCost:8.13,sizeMm:1.3,caratWeight:0.009},
  {id:"css08",category:"Complex Setting",name:"1.4mm",unit:"stone",baseCost:8.75,sizeMm:1.4,caratWeight:0.011},
  {id:"css09",category:"Complex Setting",name:"1.5mm",unit:"stone",baseCost:9.38,sizeMm:1.5,caratWeight:0.013},
  {id:"css10",category:"Complex Setting",name:"1.6mm",unit:"stone",baseCost:10.00,sizeMm:1.6,caratWeight:0.016},
  {id:"css11",category:"Complex Setting",name:"1.7mm",unit:"stone",baseCost:10.63,sizeMm:1.7,caratWeight:0.019},
  {id:"css12",category:"Complex Setting",name:"1.8mm",unit:"stone",baseCost:11.25,sizeMm:1.8,caratWeight:0.023},
  {id:"css13",category:"Complex Setting",name:"1.9mm",unit:"stone",baseCost:11.88,sizeMm:1.9,caratWeight:0.027},
  {id:"css14",category:"Complex Setting",name:"2.0mm",unit:"stone",baseCost:12.50,sizeMm:2.0,caratWeight:0.031},
  {id:"css15",category:"Complex Setting",name:"2.1mm",unit:"stone",baseCost:13.13,sizeMm:2.1,caratWeight:0.036},
  {id:"css16",category:"Complex Setting",name:"2.2mm",unit:"stone",baseCost:13.75,sizeMm:2.2,caratWeight:0.042},
  {id:"css17",category:"Complex Setting",name:"2.3mm",unit:"stone",baseCost:14.38,sizeMm:2.3,caratWeight:0.047},
  {id:"css18",category:"Complex Setting",name:"2.4mm",unit:"stone",baseCost:15.00,sizeMm:2.4,caratWeight:0.054},
  {id:"css19",category:"Complex Setting",name:"2.5mm",unit:"stone",baseCost:15.63,sizeMm:2.5,caratWeight:0.061},
  {id:"css20",category:"Complex Setting",name:"2.6mm",unit:"stone",baseCost:16.25,sizeMm:2.6,caratWeight:0.069},
  {id:"css21",category:"Complex Setting",name:"2.7mm",unit:"stone",baseCost:16.88,sizeMm:2.7,caratWeight:0.077},
  {id:"css22",category:"Complex Setting",name:"2.8mm",unit:"stone",baseCost:17.50,sizeMm:2.8,caratWeight:0.086},
  {id:"css23",category:"Complex Setting",name:"2.9mm",unit:"stone",baseCost:18.13,sizeMm:2.9,caratWeight:0.095},
  {id:"css24",category:"Complex Setting",name:"3.0mm",unit:"stone",baseCost:18.75,sizeMm:3.0,caratWeight:0.105},
  {id:"css25",category:"Complex Setting",name:"3.1mm",unit:"stone",baseCost:19.38,sizeMm:3.1,caratWeight:0.116},
  {id:"css26",category:"Complex Setting",name:"3.2mm",unit:"stone",baseCost:20.00,sizeMm:3.2,caratWeight:0.128},
  {id:"css27",category:"Complex Setting",name:"3.3mm",unit:"stone",baseCost:20.63,sizeMm:3.3,caratWeight:0.140},
  {id:"css28",category:"Complex Setting",name:"3.4mm",unit:"stone",baseCost:21.25,sizeMm:3.4,caratWeight:0.153},
  {id:"css29",category:"Complex Setting",name:"3.5mm",unit:"stone",baseCost:21.88,sizeMm:3.5,caratWeight:0.167},
  {id:"css30",category:"Complex Setting",name:"3.6mm",unit:"stone",baseCost:22.50,sizeMm:3.6,caratWeight:0.182},
  {id:"css31",category:"Complex Setting",name:"3.7mm",unit:"stone",baseCost:23.13,sizeMm:3.7,caratWeight:0.198},
  {id:"css32",category:"Complex Setting",name:"3.8mm",unit:"stone",baseCost:23.75,sizeMm:3.8,caratWeight:0.214},
  {id:"css33",category:"Complex Setting",name:"3.9mm",unit:"stone",baseCost:24.38,sizeMm:3.9,caratWeight:0.231},
  {id:"css34",category:"Complex Setting",name:"4.0mm",unit:"stone",baseCost:25.00,sizeMm:4.0,caratWeight:0.250},
  {id:"css35",category:"Complex Setting",name:"4.1mm",unit:"stone",baseCost:25.63,sizeMm:4.1,caratWeight:0.269},
  {id:"css36",category:"Complex Setting",name:"4.2mm",unit:"stone",baseCost:26.25,sizeMm:4.2,caratWeight:0.289},
  {id:"css37",category:"Complex Setting",name:"4.3mm",unit:"stone",baseCost:26.88,sizeMm:4.3,caratWeight:0.310},
  {id:"css38",category:"Complex Setting",name:"4.4mm",unit:"stone",baseCost:27.50,sizeMm:4.4,caratWeight:0.332},
  {id:"css39",category:"Complex Setting",name:"4.5mm",unit:"stone",baseCost:28.13,sizeMm:4.5,caratWeight:0.355},
  {id:"css40",category:"Complex Setting",name:"4.6mm",unit:"stone",baseCost:28.75,sizeMm:4.6,caratWeight:0.380},
  {id:"css41",category:"Complex Setting",name:"4.7mm",unit:"stone",baseCost:29.38,sizeMm:4.7,caratWeight:0.405},
  {id:"css42",category:"Complex Setting",name:"4.8mm",unit:"stone",baseCost:30.00,sizeMm:4.8,caratWeight:0.431},
  {id:"css43",category:"Complex Setting",name:"4.9mm",unit:"stone",baseCost:30.63,sizeMm:4.9,caratWeight:0.459},
  {id:"css44",category:"Complex Setting",name:"5.0mm",unit:"stone",baseCost:31.25,sizeMm:5.0,caratWeight:0.488},
  {id:"css45",category:"Complex Setting",name:"5.1mm",unit:"stone",baseCost:31.88,sizeMm:5.1,caratWeight:0.517},
  {id:"css46",category:"Complex Setting",name:"5.2mm",unit:"stone",baseCost:32.50,sizeMm:5.2,caratWeight:0.548},
  {id:"css47",category:"Complex Setting",name:"5.3mm",unit:"stone",baseCost:33.13,sizeMm:5.3,caratWeight:0.581},
  {id:"css48",category:"Complex Setting",name:"5.4mm",unit:"stone",baseCost:33.75,sizeMm:5.4,caratWeight:0.614},
  {id:"css49",category:"Complex Setting",name:"5.5mm",unit:"stone",baseCost:34.38,sizeMm:5.5,caratWeight:0.649},
  {id:"css50",category:"Complex Setting",name:"5.6mm",unit:"stone",baseCost:35.00,sizeMm:5.6,caratWeight:0.685},
  {id:"css51",category:"Complex Setting",name:"5.7mm",unit:"stone",baseCost:35.63,sizeMm:5.7,caratWeight:0.722},
  {id:"css52",category:"Complex Setting",name:"5.8mm",unit:"stone",baseCost:36.25,sizeMm:5.8,caratWeight:0.761},
  {id:"css53",category:"Complex Setting",name:"5.9mm",unit:"stone",baseCost:36.88,sizeMm:5.9,caratWeight:0.801},
  {id:"css54",category:"Complex Setting",name:"6.0mm",unit:"stone",baseCost:37.50,sizeMm:6.0,caratWeight:0.842},
  {id:"css55",category:"Complex Setting",name:"6.1mm",unit:"stone",baseCost:38.13,sizeMm:6.1,caratWeight:0.885},
  {id:"css56",category:"Complex Setting",name:"6.2mm",unit:"stone",baseCost:38.75,sizeMm:6.2,caratWeight:0.929},
  {id:"css57",category:"Complex Setting",name:"6.3mm",unit:"stone",baseCost:39.38,sizeMm:6.3,caratWeight:0.975},
  {id:"css58",category:"Complex Setting",name:"6.4mm",unit:"stone",baseCost:40.00,sizeMm:6.4,caratWeight:1.022},
  {id:"css59",category:"Complex Setting",name:"6.5mm",unit:"stone",baseCost:40.63,sizeMm:6.5,caratWeight:1.071},
  {id:"css60",category:"Complex Setting",name:"6.6mm",unit:"stone",baseCost:41.25,sizeMm:6.6,caratWeight:1.121},
  {id:"css61",category:"Complex Setting",name:"6.7mm",unit:"stone",baseCost:41.88,sizeMm:6.7,caratWeight:1.173},
  {id:"css62",category:"Complex Setting",name:"6.8mm",unit:"stone",baseCost:42.50,sizeMm:6.8,caratWeight:1.226},
  {id:"css63",category:"Complex Setting",name:"6.9mm",unit:"stone",baseCost:43.13,sizeMm:6.9,caratWeight:1.281},
  {id:"css64",category:"Complex Setting",name:"7.0mm",unit:"stone",baseCost:43.75,sizeMm:7.0,caratWeight:1.338},
  // ── Repairs ──────────────────────────────────────────────────────────────
  {id:"rp01",category:REPAIRS_CAT,group:"Cleaning & Polishing",name:"Clean and Checkup",unit:"job",baseCost:40,noMarkup:true},
  {id:"rp02",category:REPAIRS_CAT,group:"Cleaning & Polishing",name:"Clean, Checkup & Polish",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp03",category:REPAIRS_CAT,group:"Cleaning & Polishing",name:"Clean, Checkup, Polish & Rhodium",unit:"job",baseCost:120,noMarkup:true},
  {id:"rp04",category:REPAIRS_CAT,group:"Cleaning & Polishing",name:"Clean, Checkup, Polish & Rhodium (Two Tone)",unit:"job",baseCost:130,noMarkup:true},
  {id:"rp05",category:REPAIRS_CAT,group:"Ring Repairs",name:"Build up cracks & dints",unit:"job",baseCost:75,noMarkup:true},
  {id:"rp06",category:REPAIRS_CAT,group:"Ring Repairs",name:"Join rings (per join)",unit:"job",baseCost:75,noMarkup:true},
  {id:"rp07",category:REPAIRS_CAT,group:"Ring Repairs",name:"Stability balls",unit:"job",baseCost:100,noMarkup:true},
  {id:"rp08",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Silver — up to 3mm wide",name:"Resize down — Silver",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp09",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Silver — up to 3mm wide",name:"Resize up 2 sizes — Silver",unit:"job",baseCost:70,noMarkup:true},
  {id:"rp10",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Silver — up to 3mm wide",name:"Resize up 3 sizes — Silver",unit:"job",baseCost:100,noMarkup:true},
  {id:"rp11",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Silver — up to 3mm wide",name:"Each additional size — Silver",unit:"job",baseCost:35,noMarkup:true},
  {id:"rp12",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"9ct Gold — up to 3mm wide",name:"Resize down — 9ct Gold",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp13",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"9ct Gold — up to 3mm wide",name:"Resize up 2 sizes — 9ct Gold",unit:"job",baseCost:90,noMarkup:true},
  {id:"rp14",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"9ct Gold — up to 3mm wide",name:"Resize up 3 sizes — 9ct Gold",unit:"job",baseCost:135,noMarkup:true},
  {id:"rp15",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"9ct Gold — up to 3mm wide",name:"Each additional size — 9ct Gold",unit:"job",baseCost:45,noMarkup:true},
  {id:"rp16",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"18ct Gold — up to 3mm wide",name:"Resize down — 18ct Gold",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp17",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"18ct Gold — up to 3mm wide",name:"Resize up 2 sizes — 18ct Gold",unit:"job",baseCost:120,noMarkup:true},
  {id:"rp18",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"18ct Gold — up to 3mm wide",name:"Resize up 3 sizes — 18ct Gold",unit:"job",baseCost:180,noMarkup:true},
  {id:"rp19",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"18ct Gold — up to 3mm wide",name:"Each additional size — 18ct Gold",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp20",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Platinum — up to 3mm wide",name:"Resize down — Platinum",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp21",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Platinum — up to 3mm wide",name:"Resize up 2 sizes — Platinum",unit:"job",baseCost:160,noMarkup:true},
  {id:"rp22",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Platinum — up to 3mm wide",name:"Resize up 3 sizes — Platinum",unit:"job",baseCost:240,noMarkup:true},
  {id:"rp23",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",subgroup:"Platinum — up to 3mm wide",name:"Each additional size — Platinum",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp24",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Silver",name:"Resize down — Silver (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp25",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Silver",name:"Resize up 2 sizes — Silver (3mm+)",unit:"job",baseCost:110,noMarkup:true},
  {id:"rp26",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Silver",name:"Resize up 3 sizes — Silver (3mm+)",unit:"job",baseCost:165,noMarkup:true},
  {id:"rp27",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Silver",name:"Each additional size — Silver (3mm+)",unit:"job",baseCost:55,noMarkup:true},
  {id:"rp28",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"9ct Gold",name:"Resize down — 9ct Gold (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp29",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"9ct Gold",name:"Resize up 2 sizes — 9ct Gold (3mm+)",unit:"job",baseCost:130,noMarkup:true},
  {id:"rp30",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"9ct Gold",name:"Resize up 3 sizes — 9ct Gold (3mm+)",unit:"job",baseCost:195,noMarkup:true},
  {id:"rp31",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"9ct Gold",name:"Each additional size — 9ct Gold (3mm+)",unit:"job",baseCost:65,noMarkup:true},
  {id:"rp32",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"18ct Gold",name:"Resize down — 18ct Gold (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp33",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"18ct Gold",name:"Resize up 2 sizes — 18ct Gold (3mm+)",unit:"job",baseCost:160,noMarkup:true},
  {id:"rp34",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"18ct Gold",name:"Resize up 3 sizes — 18ct Gold (3mm+)",unit:"job",baseCost:240,noMarkup:true},
  {id:"rp35",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"18ct Gold",name:"Each additional size — 18ct Gold (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp36",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Platinum",name:"Resize down — Platinum (3mm+)",unit:"job",baseCost:100,noMarkup:true},
  {id:"rp37",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Platinum",name:"Resize up 2 sizes — Platinum (3mm+)",unit:"job",baseCost:220,noMarkup:true},
  {id:"rp38",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Platinum",name:"Resize up 3 sizes — Platinum (3mm+)",unit:"job",baseCost:330,noMarkup:true},
  {id:"rp39",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"Platinum",name:"Each additional size — Platinum (3mm+)",unit:"job",baseCost:110,noMarkup:true},
  {id:"rpresize_wide",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",subgroup:"6mm+ wide — manual quote required",name:"Ring resize 6mm+ wide (all metals)",unit:"job",baseCost:0,noMarkup:true,poa:true},
  {id:"rp43",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"Silver",name:"Re-tip 1 prong — Silver",unit:"job",baseCost:35,noMarkup:true},
  {id:"rp47",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"Silver",name:"Re-tip 6 prongs — Silver",unit:"job",baseCost:105,noMarkup:true},
  {id:"rp51",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"Silver",name:"Re-tip 12 prongs — Silver",unit:"job",baseCost:210,noMarkup:true},
  {id:"rp40",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"9ct Gold",name:"Re-tip 1 prong — 9ct Gold",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp44",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"9ct Gold",name:"Re-tip 6 prongs — 9ct Gold",unit:"job",baseCost:180,noMarkup:true},
  {id:"rp48",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"9ct Gold",name:"Re-tip 12 prongs — 9ct Gold",unit:"job",baseCost:360,noMarkup:true},
  {id:"rp41",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"18ct Gold",name:"Re-tip 1 prong — 18ct Gold",unit:"job",baseCost:75,noMarkup:true},
  {id:"rp45",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"18ct Gold",name:"Re-tip 6 prongs — 18ct Gold",unit:"job",baseCost:225,noMarkup:true},
  {id:"rp49",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"18ct Gold",name:"Re-tip 12 prongs — 18ct Gold",unit:"job",baseCost:450,noMarkup:true},
  {id:"rp42",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"Platinum",name:"Re-tip 1 prong — Platinum",unit:"job",baseCost:90,noMarkup:true},
  {id:"rp46",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"Platinum",name:"Re-tip 6 prongs — Platinum",unit:"job",baseCost:270,noMarkup:true},
  {id:"rp50",category:REPAIRS_CAT,group:"Claw Re-tipping",subgroup:"Platinum",name:"Re-tip 12 prongs — Platinum",unit:"job",baseCost:540,noMarkup:true},
  {id:"rp52",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"V-claw or double claw (each)",unit:"job",baseCost:90,noMarkup:true},
  {id:"rp56",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"Silver — up to 3mm wide",name:"1/4 shank replacement — Silver",unit:"job",baseCost:200,noMarkup:true},
  {id:"rp60",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"Silver — up to 3mm wide",name:"1/2 shank replacement — Silver",unit:"job",baseCost:250,noMarkup:true},
  {id:"rp64",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"Silver — up to 3mm wide",name:"3/4 shank replacement — Silver",unit:"job",baseCost:300,noMarkup:true},
  {id:"rp53",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"9ct Gold — up to 3mm wide",name:"1/4 shank replacement — 9ct Gold",unit:"job",baseCost:250,noMarkup:true},
  {id:"rp57",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"9ct Gold — up to 3mm wide",name:"1/2 shank replacement — 9ct Gold",unit:"job",baseCost:350,noMarkup:true},
  {id:"rp61",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"9ct Gold — up to 3mm wide",name:"3/4 shank replacement — 9ct Gold",unit:"job",baseCost:400,noMarkup:true},
  {id:"rp54",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"18ct Gold — up to 3mm wide",name:"1/4 shank replacement — 18ct Gold",unit:"job",baseCost:350,noMarkup:true},
  {id:"rp58",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"18ct Gold — up to 3mm wide",name:"1/2 shank replacement — 18ct Gold",unit:"job",baseCost:450,noMarkup:true},
  {id:"rp62",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"18ct Gold — up to 3mm wide",name:"3/4 shank replacement — 18ct Gold",unit:"job",baseCost:500,noMarkup:true},
  {id:"rp55",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"Platinum — up to 3mm wide",name:"1/4 shank replacement — Platinum",unit:"job",baseCost:450,noMarkup:true},
  {id:"rp59",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"Platinum — up to 3mm wide",name:"1/2 shank replacement — Platinum",unit:"job",baseCost:550,noMarkup:true},
  {id:"rp63",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"Platinum — up to 3mm wide",name:"3/4 shank replacement — Platinum",unit:"job",baseCost:600,noMarkup:true},
  {id:"rpband3mm",category:REPAIRS_CAT,group:"Band Replacements",subgroup:"3mm+ wide — manual quote required",name:"Bands 3mm+ wide (all metals)",unit:"job",baseCost:0,noMarkup:true,poa:true},
  {id:"rp65",category:REPAIRS_CAT,group:"Chain Repair",name:"Chain tumble polish",unit:"job",baseCost:15,noMarkup:true},
  {id:"rp66",category:REPAIRS_CAT,group:"Chain Repair",name:"Chain hand polish",unit:"job",baseCost:30,noMarkup:true},
  {id:"rp67",category:REPAIRS_CAT,group:"Chain Repair",name:"Solder & restore — small chain (per link)",unit:"job",baseCost:40,noMarkup:true},
  {id:"rp68",category:REPAIRS_CAT,group:"Chain Repair",name:"Solder & restore — medium chain (per link)",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp69",category:REPAIRS_CAT,group:"Chain Repair",name:"Solder & restore — large chain (per link)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp70",category:REPAIRS_CAT,group:"Chain Repair",name:"Re-build end links — small chain",unit:"job",baseCost:40,noMarkup:true},
  {id:"rp71",category:REPAIRS_CAT,group:"Chain Repair",name:"Re-build end links — medium chain",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp72",category:REPAIRS_CAT,group:"Chain Repair",name:"Re-build end links — large chain",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp73",category:REPAIRS_CAT,group:"Chain Repair",name:"Re-build bail — small",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp74",category:REPAIRS_CAT,group:"Chain Repair",name:"Re-build bail — medium",unit:"job",baseCost:90,noMarkup:true},
  {id:"rp75",category:REPAIRS_CAT,group:"Chain Repair",name:"Re-build bail — large",unit:"job",baseCost:120,noMarkup:true},
  {id:"rp76",category:REPAIRS_CAT,group:"Chain Repair",name:"Shorten chain — small",unit:"job",baseCost:40,noMarkup:true},
  {id:"rp77",category:REPAIRS_CAT,group:"Chain Repair",name:"Shorten chain — medium",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp78",category:REPAIRS_CAT,group:"Chain Repair",name:"Shorten chain — large",unit:"job",baseCost:80,noMarkup:true},
  {id:"rps01",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 0.7mm",unit:"stone",baseCost:3.50,sizeMm:0.7,noMarkup:true},
  {id:"rps02",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 0.8mm",unit:"stone",baseCost:4.00,sizeMm:0.8,noMarkup:true},
  {id:"rps03",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 0.9mm",unit:"stone",baseCost:4.50,sizeMm:0.9,noMarkup:true},
  {id:"rps04",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.0mm",unit:"stone",baseCost:5.00,sizeMm:1.0,noMarkup:true},
  {id:"rps05",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.1mm",unit:"stone",baseCost:5.50,sizeMm:1.1,noMarkup:true},
  {id:"rps06",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.2mm",unit:"stone",baseCost:6.00,sizeMm:1.2,noMarkup:true},
  {id:"rps07",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.3mm",unit:"stone",baseCost:6.50,sizeMm:1.3,noMarkup:true},
  {id:"rps08",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.4mm",unit:"stone",baseCost:7.00,sizeMm:1.4,noMarkup:true},
  {id:"rps09",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.5mm",unit:"stone",baseCost:7.50,sizeMm:1.5,noMarkup:true},
  {id:"rps10",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.6mm",unit:"stone",baseCost:8.00,sizeMm:1.6,noMarkup:true},
  {id:"rps11",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.7mm",unit:"stone",baseCost:8.50,sizeMm:1.7,noMarkup:true},
  {id:"rps12",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.8mm",unit:"stone",baseCost:9.00,sizeMm:1.8,noMarkup:true},
  {id:"rps13",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 1.9mm",unit:"stone",baseCost:9.50,sizeMm:1.9,noMarkup:true},
  {id:"rps14",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.0mm",unit:"stone",baseCost:10.00,sizeMm:2.0,noMarkup:true},
  {id:"rps15",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.1mm",unit:"stone",baseCost:10.50,sizeMm:2.1,noMarkup:true},
  {id:"rps16",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.2mm",unit:"stone",baseCost:11.00,sizeMm:2.2,noMarkup:true},
  {id:"rps17",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.3mm",unit:"stone",baseCost:11.50,sizeMm:2.3,noMarkup:true},
  {id:"rps18",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.4mm",unit:"stone",baseCost:12.00,sizeMm:2.4,noMarkup:true},
  {id:"rps19",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.5mm",unit:"stone",baseCost:12.50,sizeMm:2.5,noMarkup:true},
  {id:"rps20",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.6mm",unit:"stone",baseCost:13.00,sizeMm:2.6,noMarkup:true},
  {id:"rps21",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.7mm",unit:"stone",baseCost:13.50,sizeMm:2.7,noMarkup:true},
  {id:"rps22",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.8mm",unit:"stone",baseCost:14.00,sizeMm:2.8,noMarkup:true},
  {id:"rps23",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 2.9mm",unit:"stone",baseCost:14.50,sizeMm:2.9,noMarkup:true},
  {id:"rps24",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.0mm",unit:"stone",baseCost:15.00,sizeMm:3.0,noMarkup:true},
  {id:"rps25",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.1mm",unit:"stone",baseCost:15.50,sizeMm:3.1,noMarkup:true},
  {id:"rps26",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.2mm",unit:"stone",baseCost:16.00,sizeMm:3.2,noMarkup:true},
  {id:"rps27",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.3mm",unit:"stone",baseCost:16.50,sizeMm:3.3,noMarkup:true},
  {id:"rps28",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.4mm",unit:"stone",baseCost:17.00,sizeMm:3.4,noMarkup:true},
  {id:"rps29",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.5mm",unit:"stone",baseCost:17.50,sizeMm:3.5,noMarkup:true},
  {id:"rps30",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.6mm",unit:"stone",baseCost:18.00,sizeMm:3.6,noMarkup:true},
  {id:"rps31",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.7mm",unit:"stone",baseCost:18.50,sizeMm:3.7,noMarkup:true},
  {id:"rps32",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.8mm",unit:"stone",baseCost:19.00,sizeMm:3.8,noMarkup:true},
  {id:"rps33",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 3.9mm",unit:"stone",baseCost:19.50,sizeMm:3.9,noMarkup:true},
  {id:"rps34",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Basic — prong / pavé (small accent stones)",name:"Basic re-set — 4.0mm",unit:"stone",baseCost:20.00,sizeMm:4.0,noMarkup:true},
  {id:"rpsc01",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 0.7mm",unit:"stone",baseCost:4.38,sizeMm:0.7,noMarkup:true},
  {id:"rpsc02",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 0.8mm",unit:"stone",baseCost:5.00,sizeMm:0.8,noMarkup:true},
  {id:"rpsc03",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 0.9mm",unit:"stone",baseCost:5.63,sizeMm:0.9,noMarkup:true},
  {id:"rpsc04",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.0mm",unit:"stone",baseCost:6.25,sizeMm:1.0,noMarkup:true},
  {id:"rpsc05",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.1mm",unit:"stone",baseCost:6.88,sizeMm:1.1,noMarkup:true},
  {id:"rpsc06",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.2mm",unit:"stone",baseCost:7.50,sizeMm:1.2,noMarkup:true},
  {id:"rpsc07",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.3mm",unit:"stone",baseCost:8.13,sizeMm:1.3,noMarkup:true},
  {id:"rpsc08",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.4mm",unit:"stone",baseCost:8.75,sizeMm:1.4,noMarkup:true},
  {id:"rpsc09",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.5mm",unit:"stone",baseCost:9.38,sizeMm:1.5,noMarkup:true},
  {id:"rpsc10",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.6mm",unit:"stone",baseCost:10.00,sizeMm:1.6,noMarkup:true},
  {id:"rpsc11",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.7mm",unit:"stone",baseCost:10.63,sizeMm:1.7,noMarkup:true},
  {id:"rpsc12",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.8mm",unit:"stone",baseCost:11.25,sizeMm:1.8,noMarkup:true},
  {id:"rpsc13",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 1.9mm",unit:"stone",baseCost:11.88,sizeMm:1.9,noMarkup:true},
  {id:"rpsc14",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.0mm",unit:"stone",baseCost:12.50,sizeMm:2.0,noMarkup:true},
  {id:"rpsc15",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.1mm",unit:"stone",baseCost:13.13,sizeMm:2.1,noMarkup:true},
  {id:"rpsc16",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.2mm",unit:"stone",baseCost:13.75,sizeMm:2.2,noMarkup:true},
  {id:"rpsc17",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.3mm",unit:"stone",baseCost:14.38,sizeMm:2.3,noMarkup:true},
  {id:"rpsc18",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.4mm",unit:"stone",baseCost:15.00,sizeMm:2.4,noMarkup:true},
  {id:"rpsc19",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.5mm",unit:"stone",baseCost:15.63,sizeMm:2.5,noMarkup:true},
  {id:"rpsc20",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.6mm",unit:"stone",baseCost:16.25,sizeMm:2.6,noMarkup:true},
  {id:"rpsc21",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.7mm",unit:"stone",baseCost:16.88,sizeMm:2.7,noMarkup:true},
  {id:"rpsc22",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.8mm",unit:"stone",baseCost:17.50,sizeMm:2.8,noMarkup:true},
  {id:"rpsc23",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 2.9mm",unit:"stone",baseCost:18.13,sizeMm:2.9,noMarkup:true},
  {id:"rpsc24",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.0mm",unit:"stone",baseCost:18.75,sizeMm:3.0,noMarkup:true},
  {id:"rpsc25",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.1mm",unit:"stone",baseCost:19.38,sizeMm:3.1,noMarkup:true},
  {id:"rpsc26",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.2mm",unit:"stone",baseCost:20.00,sizeMm:3.2,noMarkup:true},
  {id:"rpsc27",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.3mm",unit:"stone",baseCost:20.63,sizeMm:3.3,noMarkup:true},
  {id:"rpsc28",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.4mm",unit:"stone",baseCost:21.25,sizeMm:3.4,noMarkup:true},
  {id:"rpsc29",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.5mm",unit:"stone",baseCost:21.88,sizeMm:3.5,noMarkup:true},
  {id:"rpsc30",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.6mm",unit:"stone",baseCost:22.50,sizeMm:3.6,noMarkup:true},
  {id:"rpsc31",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.7mm",unit:"stone",baseCost:23.13,sizeMm:3.7,noMarkup:true},
  {id:"rpsc32",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.8mm",unit:"stone",baseCost:23.75,sizeMm:3.8,noMarkup:true},
  {id:"rpsc33",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 3.9mm",unit:"stone",baseCost:24.38,sizeMm:3.9,noMarkup:true},
  {id:"rpsc34",category:REPAIRS_CAT,group:"Stone Setting (Repair)",subgroup:"Complex — channel, princess & French pavé",name:"Complex re-set — 4.0mm",unit:"stone",baseCost:25.00,sizeMm:4.0,noMarkup:true},
  {id:"rst01",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 0.7mm",unit:"stone",baseCost:1.75,sizeMm:0.7,noMarkup:true},
  {id:"rst02",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 0.8mm",unit:"stone",baseCost:2.00,sizeMm:0.8,noMarkup:true},
  {id:"rst03",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 0.9mm",unit:"stone",baseCost:2.25,sizeMm:0.9,noMarkup:true},
  {id:"rst04",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.0mm",unit:"stone",baseCost:2.50,sizeMm:1.0,noMarkup:true},
  {id:"rst05",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.1mm",unit:"stone",baseCost:2.75,sizeMm:1.1,noMarkup:true},
  {id:"rst06",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.2mm",unit:"stone",baseCost:3.00,sizeMm:1.2,noMarkup:true},
  {id:"rst07",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.3mm",unit:"stone",baseCost:3.25,sizeMm:1.3,noMarkup:true},
  {id:"rst08",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.4mm",unit:"stone",baseCost:3.50,sizeMm:1.4,noMarkup:true},
  {id:"rst09",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.5mm",unit:"stone",baseCost:3.75,sizeMm:1.5,noMarkup:true},
  {id:"rst10",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.6mm",unit:"stone",baseCost:4.00,sizeMm:1.6,noMarkup:true},
  {id:"rst11",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.7mm",unit:"stone",baseCost:4.25,sizeMm:1.7,noMarkup:true},
  {id:"rst12",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.8mm",unit:"stone",baseCost:4.50,sizeMm:1.8,noMarkup:true},
  {id:"rst13",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 1.9mm",unit:"stone",baseCost:4.75,sizeMm:1.9,noMarkup:true},
  {id:"rst14",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.0mm",unit:"stone",baseCost:5.00,sizeMm:2.0,noMarkup:true},
  {id:"rst15",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.1mm",unit:"stone",baseCost:5.25,sizeMm:2.1,noMarkup:true},
  {id:"rst16",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.2mm",unit:"stone",baseCost:5.50,sizeMm:2.2,noMarkup:true},
  {id:"rst17",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.3mm",unit:"stone",baseCost:5.75,sizeMm:2.3,noMarkup:true},
  {id:"rst18",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.4mm",unit:"stone",baseCost:6.00,sizeMm:2.4,noMarkup:true},
  {id:"rst19",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.5mm",unit:"stone",baseCost:6.25,sizeMm:2.5,noMarkup:true},
  {id:"rst20",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.6mm",unit:"stone",baseCost:6.50,sizeMm:2.6,noMarkup:true},
  {id:"rst21",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.7mm",unit:"stone",baseCost:6.75,sizeMm:2.7,noMarkup:true},
  {id:"rst22",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.8mm",unit:"stone",baseCost:7.00,sizeMm:2.8,noMarkup:true},
  {id:"rst23",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 2.9mm",unit:"stone",baseCost:7.25,sizeMm:2.9,noMarkup:true},
  {id:"rst24",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.0mm",unit:"stone",baseCost:7.50,sizeMm:3.0,noMarkup:true},
  {id:"rst25",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.1mm",unit:"stone",baseCost:7.75,sizeMm:3.1,noMarkup:true},
  {id:"rst26",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.2mm",unit:"stone",baseCost:8.00,sizeMm:3.2,noMarkup:true},
  {id:"rst27",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.3mm",unit:"stone",baseCost:8.25,sizeMm:3.3,noMarkup:true},
  {id:"rst28",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.4mm",unit:"stone",baseCost:8.50,sizeMm:3.4,noMarkup:true},
  {id:"rst29",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.5mm",unit:"stone",baseCost:8.75,sizeMm:3.5,noMarkup:true},
  {id:"rst30",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.6mm",unit:"stone",baseCost:9.00,sizeMm:3.6,noMarkup:true},
  {id:"rst31",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.7mm",unit:"stone",baseCost:9.25,sizeMm:3.7,noMarkup:true},
  {id:"rst32",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.8mm",unit:"stone",baseCost:9.50,sizeMm:3.8,noMarkup:true},
  {id:"rst33",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 3.9mm",unit:"stone",baseCost:9.75,sizeMm:3.9,noMarkup:true},
  {id:"rst34",category:REPAIRS_CAT,group:"Stone Tightening",subgroup:"Small accent stones (up to 4.0mm) — 50% of basic setting rate",name:"Stone tightening — 4.0mm",unit:"stone",baseCost:10.00,sizeMm:4.0,noMarkup:true},
  {id:"rmd01",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 0.8mm",unit:"stone",baseCost:0.81,sizeMm:0.8,caratWeight:0.002,noMarkup:true},
  {id:"rmd02",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 0.9mm",unit:"stone",baseCost:0.92,sizeMm:0.9,caratWeight:0.003,noMarkup:true},
  {id:"rmd03",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.0mm",unit:"stone",baseCost:1.46,sizeMm:1.0,caratWeight:0.004,noMarkup:true},
  {id:"rmd04",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.1mm",unit:"stone",baseCost:1.32,sizeMm:1.1,caratWeight:0.005,noMarkup:true},
  {id:"rmd05",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.2mm",unit:"stone",baseCost:1.27,sizeMm:1.2,caratWeight:0.007,noMarkup:true},
  {id:"rmd06",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.3mm",unit:"stone",baseCost:1.37,sizeMm:1.3,caratWeight:0.009,noMarkup:true},
  {id:"rmd07",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.4mm",unit:"stone",baseCost:1.36,sizeMm:1.4,caratWeight:0.011,noMarkup:true},
  {id:"rmd08",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.5mm",unit:"stone",baseCost:2.18,sizeMm:1.5,caratWeight:0.013,noMarkup:true},
  {id:"rmd09",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.6mm",unit:"stone",baseCost:2.09,sizeMm:1.6,caratWeight:0.016,noMarkup:true},
  {id:"rmd10",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.7mm",unit:"stone",baseCost:2.45,sizeMm:1.7,caratWeight:0.019,noMarkup:true},
  {id:"rmd11",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.8mm",unit:"stone",baseCost:2.72,sizeMm:1.8,caratWeight:0.023,noMarkup:true},
  {id:"rmd12",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 1.9mm",unit:"stone",baseCost:2.52,sizeMm:1.9,caratWeight:0.027,noMarkup:true},
  {id:"rmd13",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.0mm",unit:"stone",baseCost:3.85,sizeMm:2.0,caratWeight:0.031,noMarkup:true},
  {id:"rmd14",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.1mm",unit:"stone",baseCost:2.89,sizeMm:2.1,caratWeight:0.036,noMarkup:true},
  {id:"rmd15",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.2mm",unit:"stone",baseCost:3.35,sizeMm:2.2,caratWeight:0.042,noMarkup:true},
  {id:"rmd16",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.3mm",unit:"stone",baseCost:3.88,sizeMm:2.3,caratWeight:0.047,noMarkup:true},
  {id:"rmd17",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.4mm",unit:"stone",baseCost:4.22,sizeMm:2.4,caratWeight:0.054,noMarkup:true},
  {id:"rmd18",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.5mm",unit:"stone",baseCost:4.49,sizeMm:2.5,caratWeight:0.061,noMarkup:true},
  {id:"rmd19",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.6mm",unit:"stone",baseCost:4.46,sizeMm:2.6,caratWeight:0.069,noMarkup:true},
  {id:"rmd20",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.7mm",unit:"stone",baseCost:5.43,sizeMm:2.7,caratWeight:0.077,noMarkup:true},
  {id:"rmd21",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.8mm",unit:"stone",baseCost:6.11,sizeMm:2.8,caratWeight:0.086,noMarkup:true},
  {id:"rmd22",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 2.9mm",unit:"stone",baseCost:6.72,sizeMm:2.9,caratWeight:0.095,noMarkup:true},
  {id:"rmd23",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.0mm",unit:"stone",baseCost:7.36,sizeMm:3.0,caratWeight:0.105,noMarkup:true},
  {id:"rmd24",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.1mm",unit:"stone",baseCost:11.36,sizeMm:3.1,caratWeight:0.116,noMarkup:true},
  {id:"rmd25",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.2mm",unit:"stone",baseCost:10.40,sizeMm:3.2,caratWeight:0.128,noMarkup:true},
  {id:"rmd26",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.3mm",unit:"stone",baseCost:10.00,sizeMm:3.3,caratWeight:0.140,noMarkup:true},
  {id:"rmd27",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.4mm",unit:"stone",baseCost:11.80,sizeMm:3.4,caratWeight:0.153,noMarkup:true},
  {id:"rmd28",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.5mm",unit:"stone",baseCost:16.00,sizeMm:3.5,caratWeight:0.167,noMarkup:true},
  {id:"rmd29",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.6mm",unit:"stone",baseCost:20.00,sizeMm:3.6,caratWeight:0.182,noMarkup:true},
  {id:"rmd30",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.7mm",unit:"stone",baseCost:22.00,sizeMm:3.7,caratWeight:0.198,noMarkup:true},
  {id:"rmd31",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.8mm",unit:"stone",baseCost:26.00,sizeMm:3.8,caratWeight:0.214,noMarkup:true},
  {id:"rmd32",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 3.9mm",unit:"stone",baseCost:28.00,sizeMm:3.9,caratWeight:0.231,noMarkup:true},
  {id:"rmd33",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Lab grown D-E — small round accent diamonds (up to 4.0mm)",name:"Lab grown D-E — 4.0mm",unit:"stone",baseCost:30.00,sizeMm:4.0,caratWeight:0.250,noMarkup:true},
  {id:"rmdng01",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 0.8mm",unit:"stone",baseCost:1.42,sizeMm:0.8,caratWeight:0.002,noMarkup:true},
  {id:"rmdng02",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 0.9mm",unit:"stone",baseCost:2.02,sizeMm:0.9,caratWeight:0.003,noMarkup:true},
  {id:"rmdng03",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.0mm",unit:"stone",baseCost:2.67,sizeMm:1.0,caratWeight:0.004,noMarkup:true},
  {id:"rmdng04",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.1mm",unit:"stone",baseCost:3.38,sizeMm:1.1,caratWeight:0.005,noMarkup:true},
  {id:"rmdng05",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.2mm",unit:"stone",baseCost:4.20,sizeMm:1.2,caratWeight:0.007,noMarkup:true},
  {id:"rmdng06",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.3mm",unit:"stone",baseCost:4.67,sizeMm:1.3,caratWeight:0.009,noMarkup:true},
  {id:"rmdng07",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.4mm",unit:"stone",baseCost:5.16,sizeMm:1.4,caratWeight:0.011,noMarkup:true},
  {id:"rmdng08",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.5mm",unit:"stone",baseCost:7.41,sizeMm:1.5,caratWeight:0.013,noMarkup:true},
  {id:"rmdng09",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.6mm",unit:"stone",baseCost:7.20,sizeMm:1.6,caratWeight:0.016,noMarkup:true},
  {id:"rmdng10",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.7mm",unit:"stone",baseCost:8.70,sizeMm:1.7,caratWeight:0.019,noMarkup:true},
  {id:"rmdng11",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.8mm",unit:"stone",baseCost:12.50,sizeMm:1.8,caratWeight:0.023,noMarkup:true},
  {id:"rmdng12",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 1.9mm",unit:"stone",baseCost:14.50,sizeMm:1.9,caratWeight:0.027,noMarkup:true},
  {id:"rmdng13",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.0mm",unit:"stone",baseCost:18.25,sizeMm:2.0,caratWeight:0.031,noMarkup:true},
  {id:"rmdng14",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.1mm",unit:"stone",baseCost:19.90,sizeMm:2.1,caratWeight:0.036,noMarkup:true},
  {id:"rmdng15",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.2mm",unit:"stone",baseCost:24.15,sizeMm:2.2,caratWeight:0.042,noMarkup:true},
  {id:"rmdng16",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.3mm",unit:"stone",baseCost:31.15,sizeMm:2.3,caratWeight:0.047,noMarkup:true},
  {id:"rmdng17",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.4mm",unit:"stone",baseCost:35.07,sizeMm:2.4,caratWeight:0.054,noMarkup:true},
  {id:"rmdng18",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.5mm",unit:"stone",baseCost:40.38,sizeMm:2.5,caratWeight:0.061,noMarkup:true},
  {id:"rmdng19",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.6mm",unit:"stone",baseCost:44.65,sizeMm:2.6,caratWeight:0.069,noMarkup:true},
  {id:"rmdng20",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.7mm",unit:"stone",baseCost:54.65,sizeMm:2.7,caratWeight:0.077,noMarkup:true},
  {id:"rmdng21",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.8mm",unit:"stone",baseCost:61.88,sizeMm:2.8,caratWeight:0.086,noMarkup:true},
  {id:"rmdng22",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 2.9mm",unit:"stone",baseCost:70.44,sizeMm:2.9,caratWeight:0.095,noMarkup:true},
  {id:"rmdng23",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.0mm",unit:"stone",baseCost:79.50,sizeMm:3.0,caratWeight:0.105,noMarkup:true},
  {id:"rmdng24",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.1mm",unit:"stone",baseCost:86.79,sizeMm:3.1,caratWeight:0.116,noMarkup:true},
  {id:"rmdng25",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.2mm",unit:"stone",baseCost:98.80,sizeMm:3.2,caratWeight:0.128,noMarkup:true},
  {id:"rmdng26",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.3mm",unit:"stone",baseCost:105.60,sizeMm:3.3,caratWeight:0.140,noMarkup:true},
  {id:"rmdng27",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.4mm",unit:"stone",baseCost:113.00,sizeMm:3.4,caratWeight:0.153,noMarkup:true},
  {id:"rmdng28",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.5mm",unit:"stone",baseCost:121.60,sizeMm:3.5,caratWeight:0.167,noMarkup:true},
  {id:"rmdng29",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.6mm",unit:"stone",baseCost:132.50,sizeMm:3.6,caratWeight:0.182,noMarkup:true},
  {id:"rmdng30",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.7mm",unit:"stone",baseCost:164.50,sizeMm:3.7,caratWeight:0.198,noMarkup:true},
  {id:"rmdng31",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.8mm",unit:"stone",baseCost:182.50,sizeMm:3.8,caratWeight:0.214,noMarkup:true},
  {id:"rmdng32",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 3.9mm",unit:"stone",baseCost:210.00,sizeMm:3.9,caratWeight:0.231,noMarkup:true},
  {id:"rmdng33",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural G-H SI1 — small round accent diamonds (up to 4.0mm)",name:"Natural G-H SI1 — 4.0mm",unit:"stone",baseCost:222.50,sizeMm:4.0,caratWeight:0.250,noMarkup:true},
  {id:"rmdnd01",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 0.8mm",unit:"stone",baseCost:1.88,sizeMm:0.8,caratWeight:0.002,noMarkup:true},
  {id:"rmdnd02",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 0.9mm",unit:"stone",baseCost:2.67,sizeMm:0.9,caratWeight:0.003,noMarkup:true},
  {id:"rmdnd03",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.0mm",unit:"stone",baseCost:3.54,sizeMm:1.0,caratWeight:0.004,noMarkup:true},
  {id:"rmdnd04",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.1mm",unit:"stone",baseCost:4.48,sizeMm:1.1,caratWeight:0.005,noMarkup:true},
  {id:"rmdnd05",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.2mm",unit:"stone",baseCost:4.85,sizeMm:1.2,caratWeight:0.007,noMarkup:true},
  {id:"rmdnd06",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.3mm",unit:"stone",baseCost:5.70,sizeMm:1.3,caratWeight:0.009,noMarkup:true},
  {id:"rmdnd07",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.4mm",unit:"stone",baseCost:6.80,sizeMm:1.4,caratWeight:0.011,noMarkup:true},
  {id:"rmdnd08",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.5mm",unit:"stone",baseCost:9.26,sizeMm:1.5,caratWeight:0.013,noMarkup:true},
  {id:"rmdnd09",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.6mm",unit:"stone",baseCost:9.43,sizeMm:1.6,caratWeight:0.016,noMarkup:true},
  {id:"rmdnd10",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.7mm",unit:"stone",baseCost:11.04,sizeMm:1.7,caratWeight:0.019,noMarkup:true},
  {id:"rmdnd11",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.8mm",unit:"stone",baseCost:15.00,sizeMm:1.8,caratWeight:0.023,noMarkup:true},
  {id:"rmdnd12",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 1.9mm",unit:"stone",baseCost:15.97,sizeMm:1.9,caratWeight:0.027,noMarkup:true},
  {id:"rmdnd13",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.0mm",unit:"stone",baseCost:20.00,sizeMm:2.0,caratWeight:0.031,noMarkup:true},
  {id:"rmdnd14",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.1mm",unit:"stone",baseCost:25.00,sizeMm:2.1,caratWeight:0.036,noMarkup:true},
  {id:"rmdnd15",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.2mm",unit:"stone",baseCost:28.18,sizeMm:2.2,caratWeight:0.042,noMarkup:true},
  {id:"rmdnd16",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.3mm",unit:"stone",baseCost:38.20,sizeMm:2.3,caratWeight:0.047,noMarkup:true},
  {id:"rmdnd17",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.4mm",unit:"stone",baseCost:39.50,sizeMm:2.4,caratWeight:0.054,noMarkup:true},
  {id:"rmdnd18",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.5mm",unit:"stone",baseCost:46.50,sizeMm:2.5,caratWeight:0.061,noMarkup:true},
  {id:"rmdnd19",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.6mm",unit:"stone",baseCost:50.00,sizeMm:2.6,caratWeight:0.069,noMarkup:true},
  {id:"rmdnd20",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.7mm",unit:"stone",baseCost:64.50,sizeMm:2.7,caratWeight:0.077,noMarkup:true},
  {id:"rmdnd21",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.8mm",unit:"stone",baseCost:72.50,sizeMm:2.8,caratWeight:0.086,noMarkup:true},
  {id:"rmdnd22",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 2.9mm",unit:"stone",baseCost:85.50,sizeMm:2.9,caratWeight:0.095,noMarkup:true},
  {id:"rmdnd23",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.0mm",unit:"stone",baseCost:93.50,sizeMm:3.0,caratWeight:0.105,noMarkup:true},
  {id:"rmdnd24",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.1mm",unit:"stone",baseCost:103.50,sizeMm:3.1,caratWeight:0.116,noMarkup:true},
  {id:"rmdnd25",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.2mm",unit:"stone",baseCost:117.50,sizeMm:3.2,caratWeight:0.128,noMarkup:true},
  {id:"rmdnd26",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.3mm",unit:"stone",baseCost:127.50,sizeMm:3.3,caratWeight:0.140,noMarkup:true},
  {id:"rmdnd27",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.4mm",unit:"stone",baseCost:154.00,sizeMm:3.4,caratWeight:0.153,noMarkup:true},
  {id:"rmdnd28",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.5mm",unit:"stone",baseCost:167.50,sizeMm:3.5,caratWeight:0.167,noMarkup:true},
  {id:"rmdnd29",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.6mm",unit:"stone",baseCost:181.00,sizeMm:3.6,caratWeight:0.182,noMarkup:true},
  {id:"rmdnd30",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.7mm",unit:"stone",baseCost:216.00,sizeMm:3.7,caratWeight:0.198,noMarkup:true},
  {id:"rmdnd31",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.8mm",unit:"stone",baseCost:249.00,sizeMm:3.8,caratWeight:0.214,noMarkup:true},
  {id:"rmdnd32",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 3.9mm",unit:"stone",baseCost:275.00,sizeMm:3.9,caratWeight:0.231,noMarkup:true},
  {id:"rmdnd33",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Natural D-E VS — small round accent diamonds (up to 4.0mm)",name:"Natural D-E VS — 4.0mm",unit:"stone",baseCost:300.00,sizeMm:4.0,caratWeight:0.250,noMarkup:true},
  {id:"rmdf01",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Fancy shapes — princess, oval, pear, marquise etc. — add stone replacement",name:"Fancy shape — Lab grown D-E",unit:"stone",baseCost:0,noMarkup:true,poa:true},
  {id:"rmdf02",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Fancy shapes — princess, oval, pear, marquise etc. — add stone replacement",name:"Fancy shape — Natural G-H SI1",unit:"stone",baseCost:0,noMarkup:true,poa:true},
  {id:"rmdf03",category:REPAIRS_CAT,group:"Diamond Replacement",subgroup:"Fancy shapes — princess, oval, pear, marquise etc. — add stone replacement",name:"Fancy shape — Natural D-E VS",unit:"stone",baseCost:0,noMarkup:true,poa:true},
];
const SEED_PRICING_IDS=new Set(SEED_PRICING.map(x=>x.id));   // which pricing ids are built-in (vs user-added)
const SEED_CLIENTS=[
  {id:"c1",name:"Sarah Mitchell",email:"sarah@example.com",phone:"0412 345 678",ringSize:"N",metalPref:"18ct white gold",stonePref:"Diamond",budget:"8000",anniversary:"2019-03-14",notes:"Prefers modern minimal. Allergic to nickel.",createdAt:"2024-10-01"},
  {id:"c2",name:"James Nguyen",email:"james@example.com",phone:"0421 987 654",ringSize:"T",metalPref:"Platinum",stonePref:"Sapphire",budget:"12000",anniversary:"",notes:"Open to coloured stones. Wants something unique.",createdAt:"2024-11-15"},
];
const SEED_JOBS=[
  {id:"j1",clientId:"c1",type:"Engagement ring",stage:"Render approval",description:"Oval cut diamond solitaire, 4-claw, 18ct white gold band, 1.2ct G VS2",deadline:"2025-02-14",notes:"Valentine's Day proposal planned.",supplier:"",supplierRef:"",createdAt:"2024-10-05"},
  {id:"j2",clientId:"c2",type:"Custom pendant",stage:"Consultation",description:"Custom sapphire pendant, platinum, family heirloom stones",deadline:"2025-03-01",notes:"Client bringing stones for appraisal.",supplier:"",supplierRef:"",createdAt:"2024-11-20"},
];
// New quote format: lineItems have costLow + optional costHigh (for ranges), no per-item markup
const SEED_QUOTES=[{
  id:"q1",jobId:"j1",status:"Approved",createdAt:"2024-10-12",validUntil:"2024-11-12",
  lineItems:[
    {id:"li1",description:"18ct white gold",detail:"4.8g × $78.75/g",costLow:378,costHigh:0},
    {id:"li2",description:"Oval diamond 1.2ct G VS2",detail:"Supplied by client / allocated",costLow:4800,costHigh:0},
    {id:"li3",description:"Claw setting",detail:"1 stone, 4-claw solitaire",costLow:18,costHigh:0},
    {id:"li4",description:"Bench labour",detail:"4 hrs × $70/hr",costLow:280,costHigh:0},
    {id:"li5",description:"CAD design",detail:"2 rounds × $90/hr — 1 hr each",costLow:180,costHigh:0},
    {id:"li6",description:"Print & cast",detail:"1 piece",costLow:90,costHigh:0},
  ],
  notes:"Price locked at approval. Gold at $78.75/g on 12 Oct 2024.",
}];
const SEED_PAYMENTS=[
  {id:"pay1",jobId:"j1",type:"Deposit",amount:2000,date:"2024-10-13",method:"Bank transfer",notes:"Initial deposit to begin design",status:"Received"},
  {id:"pay2",jobId:"j1",type:"CAD / Design stage",amount:500,date:"2024-11-01",method:"Card (EFTPOS)",notes:"",status:"Received"},
];
const SEED_NOTES=[
  {id:"n1",jobId:"j1",type:"Client call",text:"Confirmed oval shape, white gold, 4-claw. Happy with design direction.",date:"2024-10-06",createdAt:"2024-10-06T10:30:00"},
  {id:"n2",jobId:"j1",type:"Approval received",text:"Client approved CAD render via email. Proceeding to wax print.",date:"2024-11-02",createdAt:"2024-11-02T14:15:00"},
];
const SEED_APPOINTMENTS=[];

// ── Utils ─────────────────────────────────────────────────────────────────
const uid=()=>Math.random().toString(36).slice(2,9);
// Longer, hard-to-guess token for public proposal share links (~20 chars)
const proposalToken=()=>(uid()+uid()+Date.now().toString(36)).replace(/[^a-z0-9]/gi,"").slice(0,20);
const fmt=n=>`${CUR_SYM}${Number(n||0).toLocaleString(LOCALE,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// ── Client-facing email (proposal / invoice / repair links) via the `send-email` edge function ──
// Supabase gives functions an auto-generated URL slug separate from the display name;
// this one's display name is "send-email" but its slug (used in the URL) is "smart-worker".
const SEND_EMAIL_FN="smart-worker";
// The calendar-feed edge function's URL slug (update to the real slug once deployed, like above).
const CAL_FEED_FN="calendar-feed";
const calFeedUrl=(token)=>token?`${(import.meta.env.VITE_SUPABASE_URL||"").replace(/\/$/,"")}/functions/v1/${CAL_FEED_FN}?token=${token}`:"";
const _emlEsc=(s)=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
// Branded, email-safe HTML: studio wordmark, greeting, message, a CTA button + raw link, footer.
// Deliberately no <img>/data-URI logo — many mail clients block data URIs and show a broken image.
function buildClientEmailHtml({biz,clientName,message,ctaLabel,linkUrl,reviewUrl}){
  const name=_emlEsc(biz?.name||"Your jeweller");
  const contact=[biz?.email,biz?.phone].filter(Boolean).map(_emlEsc).join(" · ");
  const greeting=clientName?`Hi ${_emlEsc(clientName)},`:"Hello,";
  const body=_emlEsc(message).replace(/\n/g,"<br>");
  const url=_emlEsc(linkUrl);
  // The CTA + "open in browser" block only render when there's a link (e.g. proposal/invoice).
  // Link-free notifications (a "ready for collection" alert) skip them and read as a plain message.
  const cta=linkUrl
    ?`<a href="${url}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:6px;font-size:15px;font-weight:700">${_emlEsc(ctaLabel)}</a>`
      +`<p style="font-size:13px;color:#888888;line-height:1.6;margin:26px 0 0">Or open this link in your browser:<br><a href="${url}" style="color:#666666">${url}</a></p>`
    :"";
  // Optional "Review us on Google" CTA — only passed by the ready-for-collection email.
  const revUrl=_emlEsc((reviewUrl||"").trim());
  const review=revUrl
    ?`<div style="margin-top:28px;text-align:center"><p style="font-size:14px;color:#555555;line-height:1.6;margin:0 0 12px">Happy with your piece? A quick Google review means the world to a small studio.</p><a href="${revUrl}" style="display:inline-block;background:#2D7A4F;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:6px;font-size:14px;font-weight:700">&#9733; Review us on Google</a></div>`
    :"";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;padding:8px">`
    +`<div style="border-bottom:2px solid #eeeeee;padding-bottom:14px;margin-bottom:20px"><div style="font-size:20px;font-weight:700;letter-spacing:0.02em">${name}</div></div>`
    +`<p style="font-size:15px;margin:0 0 14px">${greeting}</p>`
    +`<p style="font-size:15px;line-height:1.6;margin:0 0 22px">${body}</p>`
    +cta
    +review
    +`<div style="border-top:1px solid #eeeeee;margin-top:26px;padding-top:14px;font-size:12px;color:#999999">${name}${contact?` &middot; ${contact}`:""}</div>`
    +`</div>`;
}
const isEmail=x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x||"").trim());
async function sendClientEmail({to,cc,replyTo,fromName,subject,html}){
  if(!supabaseEnabled||!supabase) throw new Error("Email needs the cloud — you're in local-only mode.");
  const _bare=(String(to||"").trim().match(/<([^>]+)>/)||[,String(to||"").trim()])[1].trim();
  if(!isEmail(_bare)) throw new Error(`That email address doesn't look valid: "${String(to||"").trim()||"(blank)"}". Check the client's email and try again.`);
  const{data,error}=await supabase.functions.invoke(SEND_EMAIL_FN,{body:{to,cc,replyTo,fromName,subject,html}});
  if(error){
    // invoke() only gives a generic "non-2xx" message; the function returns the real reason in its
    // JSON body ({error:"…"}), so read it from the error's response context and surface that.
    let detail="";
    try{const b=await error?.context?.json?.();detail=b?.error||b?.message||"";}catch(_){}
    if(!detail){try{detail=(await error?.context?.text?.())||"";}catch(_){}}
    throw new Error(detail||error.message||"Couldn't reach the email service — is the send-email function deployed?");
  }
  if(data&&data.error) throw new Error(data.error);
  return data;
}

// ── SaaS subscription billing (Stripe) ──────────────────────────────────────
// All billing UI/gating is inert unless this deploy opts in (VITE_BILLING_ENABLED="true").
// The dogfooding/business deploy leaves it off → zero effect on the owner's own use.
// Billing turns on for the customer-facing deploys — either via the env var, or by hostname (so
// the tester/customer domains work without a build-time env var). The owner's business app
// (vahe-platform.vercel.app) and local dev are deliberately NOT listed, so billing stays off there.
const BILLING_HOSTS=["vahe-testers.vercel.app","prongstudio.app","www.prongstudio.app","app.prongstudio.app","app.workshoppilot.app","workshoppilot.app"];   // customer-facing domains (billing launched; all studios comped active before enabling the new workshoppilot.app domain)
const BILLING_ENABLED=import.meta.env.VITE_BILLING_ENABLED==="true"
  ||(typeof window!=="undefined"&&BILLING_HOSTS.includes(window.location.hostname));
// Call the `billing` edge fn (checkout | portal) and send the browser to the Stripe URL it returns.
async function goBilling(action,plan){
  if(!supabaseEnabled||!supabase)throw new Error("Billing needs the cloud.");
  const{data,error}=await supabase.functions.invoke("billing",{body:{action,plan,returnUrl:window.location.origin}});
  if(error){
    // Surface the edge function's actual error body (the real Stripe/config reason), not the generic message.
    let detail="";
    try{const body=await error.context?.json?.();detail=body?.error||"";}catch(_){}
    throw new Error(detail||error.message||"Couldn't reach the billing service.");
  }
  if(data&&data.error)throw new Error(data.error);
  if(data&&data.url){window.location.href=data.url;return;}
  throw new Error("No checkout URL returned.");
}
// Derive a studio's access level from its billing fields. Full access unless billing is enabled
// AND the studio is lapsed (trial ended with no active subscription). Existing/comped studios are
// 'active' so they're never gated; new signups are 'trialing' until they subscribe.
// Read-only enforcement (Stage B). Module-level so any handler can gate itself without prop-drilling.
// Defaults to editable → a total no-op unless billing is enabled AND the studio has lapsed.
let _canEdit=true;
const setCanEdit=(v)=>{_canEdit=v;};
// Call at the top of a create/save/record handler: returns true if editing is allowed, else pops a
// prompt and returns false so the caller bails. Viewing, exporting and subscribing stay available.
const guardEdit=()=>{
  if(_canEdit)return true;
  try{alert("Your trial has ended.\n\nYour data is safe and you can still view and export everything — but adding or editing needs an active subscription.\n\nGo to Settings → Subscription to subscribe.");}catch(e){}
  return false;
};
function billingState(sub){
  const status=sub?.sub_status||null;
  const trialEndsAt=sub?.trial_ends_at?new Date(sub.trial_ends_at).getTime():null;
  const now=Date.now();
  const active=status==="active";
  const trialing=status==="trialing";
  const trialLive=trialing&&(trialEndsAt==null||trialEndsAt>now);
  const daysLeft=trialEndsAt!=null?Math.max(0,Math.ceil((trialEndsAt-now)/86400000)):null;
  const canEdit=!BILLING_ENABLED||active||trialLive;
  return {enabled:BILLING_ENABLED,status,plan:sub?.plan||null,active,trialing,trialLive,daysLeft,periodEnd:sub?.current_period_end||null,canEdit,lapsed:BILLING_ENABLED&&!canEdit};
}
// Reusable "✉️ Email" button + review dialog. Disabled until a shareable link exists.
function EmailClientButton({to,clientName,biz,linkUrl,docType,defaultSubject,defaultMessage}){
  const[open,setOpen]=useState(false);
  const[email,setEmail]=useState("");
  const[subject,setSubject]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[sent,setSent]=useState(false);
  const[err,setErr]=useState("");
  const openIt=()=>{setEmail(to||"");setSubject(defaultSubject||"");setMessage(defaultMessage||"");setErr("");setSent(false);setOpen(true);};
  const send=async()=>{
    if(!email.trim()){setErr("Enter the client's email address.");return;}
    if(!linkUrl){setErr("Create the link first, then email it.");return;}
    setBusy(true);setErr("");
    try{
      const html=buildClientEmailHtml({biz,clientName,message,ctaLabel:`View ${docType}`,linkUrl});
      await sendClientEmail({to:email.trim(),replyTo:biz?.email||"",fromName:biz?.name||"Your jeweller",subject:subject.trim()||defaultSubject||docType,html});
      setSent(true);setTimeout(()=>setOpen(false),1400);
    }catch(e){setErr(e?.message||"Couldn't send the email.");}
    setBusy(false);
  };
  return <>
    <Btn sm ghost onClick={openIt} disabled={!linkUrl}>✉️ Email</Btn>
    {open&&<Modal title={`Email ${docType} to client`} onClose={()=>setOpen(false)}>
      {sent
        ?<div style={{padding:"14px 2px",fontSize:14,color:OK,fontWeight:700}}>✓ Sent to {email}</div>
        :<div>
          <Input label="To" value={email} onChange={setEmail} placeholder="client@example.com"/>
          <Input label="Subject" value={subject} onChange={setSubject}/>
          <Input label="Message" value={message} onChange={setMessage} as="textarea" rows={4}/>
          <div style={{fontSize:12,color:WG,margin:"4px 0 14px",lineHeight:1.5}}>A <strong style={{color:INK}}>View {docType}</strong> button linking to the {docType} is added automatically. Sent from <strong style={{color:INK}}>{biz?.name||"your studio"}</strong>{biz?.email?`; replies go to ${biz.email}`:""}.</div>
          {err&&<div style={{fontSize:13,color:DANGER,marginBottom:12,lineHeight:1.5}}>{err}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <Btn sm ghost onClick={()=>setOpen(false)}>Cancel</Btn>
            <Btn sm onClick={send} disabled={busy}>{busy?"Sending…":"Send email"}</Btn>
          </div>
        </div>}
    </Modal>}
  </>;
}

// Google "G" logo (inline SVG, brand colours) — used on the review-request buttons so it's clear
// these ask for a GOOGLE review. No external load (CSP-safe).
const ICON_GOOGLE=<svg width="13" height="13" viewBox="0 0 48 48" aria-hidden="true" style={{verticalAlign:"-2px",marginRight:6,flexShrink:0}}><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>;
// Standalone "ask for a Google review" email — not tied to a job. Sends a short message with
// just the review button (biz.googleReviewUrl). Disabled without a review link or a client email.
function ReviewRequestButton({to,clientName,biz,clientId,setClients}){
  const[open,setOpen]=useState(false);
  const[email,setEmail]=useState("");
  const[subject,setSubject]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[sent,setSent]=useState(false);
  const[err,setErr]=useState("");
  const reviewUrl=(biz?.googleReviewUrl||"").trim();
  const defSubject=`Thank you from ${biz?.name||"us"}`;
  const defMessage=`Thank you so much for choosing ${biz?.name||"us"}. If you have a moment, a quick Google review would mean the world to our small studio.`;
  const openIt=()=>{setEmail(to||"");setSubject(defSubject);setMessage(defMessage);setErr("");setSent(false);setOpen(true);};
  const send=async()=>{
    if(!email.trim()){setErr("Enter the client's email address.");return;}
    if(!reviewUrl){setErr("Add a Google review link in Settings first.");return;}
    setBusy(true);setErr("");
    try{
      const html=buildClientEmailHtml({biz,clientName,message,reviewUrl});
      await sendClientEmail({to:email.trim(),replyTo:biz?.email||"",fromName:biz?.name||"Your jeweller",subject:subject.trim()||defSubject,html});
      if(setClients&&clientId)setClients(p=>{const n=p.map(c=>c.id===clientId?{...c,reviewRequestedAt:today()}:c);persist(K.cl,n);return n;});
      setSent(true);setTimeout(()=>setOpen(false),1400);
    }catch(e){setErr(e?.message||"Couldn't send the email.");}
    setBusy(false);
  };
  return <>
    <Btn sm ghost onClick={openIt} disabled={!reviewUrl||!to} title={!reviewUrl?"Add a Google review link in Settings":(!to?"Add an email to this client":"")}>{ICON_GOOGLE}Ask for a Google review</Btn>
    {open&&<Modal title="Ask for a Google review" onClose={()=>setOpen(false)}>
      {sent
        ?<div style={{padding:"14px 2px",fontSize:14,color:OK,fontWeight:700}}>✓ Sent to {email}</div>
        :<div>
          <Input label="To" value={email} onChange={setEmail} placeholder="client@example.com"/>
          <Input label="Subject" value={subject} onChange={setSubject}/>
          <Input label="Message" value={message} onChange={setMessage} as="textarea" rows={4}/>
          <div style={{fontSize:12,color:WG,margin:"4px 0 14px",lineHeight:1.5}}>A <strong style={{color:INK}}>Review us on Google</strong> button is added automatically. Sent from <strong style={{color:INK}}>{biz?.name||"your studio"}</strong>{biz?.email?`, replies go to ${biz.email}`:""}.</div>
          {err&&<div style={{fontSize:13,color:DANGER,marginBottom:12,lineHeight:1.5}}>{err}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <Btn sm ghost onClick={()=>setOpen(false)}>Cancel</Btn>
            <Btn sm onClick={send} disabled={busy}>{busy?"Sending…":"Send review request"}</Btn>
          </div>
        </div>}
    </Modal>}
  </>;
}

// Bulk "ask recent clients for a review" — lists clients active in the last 90 days (with an email),
// lets you tick which to send to, emails each the review button, and stamps reviewRequestedAt on the
// ones that send. Sequential with light pacing to stay under the email service's rate limits.
function BulkReviewButton({clients,jobs,payments,biz,setClients}){
  const NINETY=90*24*3600*1000;
  const[open,setOpen]=useState(false);
  const[sel,setSel]=useState(()=>new Set());
  const[busy,setBusy]=useState(false);
  const[prog,setProg]=useState(null);
  const[done,setDone]=useState(null);
  const reviewUrl=(biz?.googleReviewUrl||"").trim();
  const recent=useMemo(()=>{
    const cutoff=Date.now()-NINETY;
    return clients.map(c=>{
      const email=(c.email||c.partnerEmail||"").trim();
      if(!isEmail(email))return null;
      const cj=jobs.filter(j=>j.clientId===c.id);
      const doneJobs=cj.filter(j=>DONE_STAGES.includes(j.stage));
      if(!doneJobs.length)return null;   // only clients who have completed work with us
      const ds=[...doneJobs.map(j=>j.readyNotifiedAt||j.createdAt),
                ...payments.filter(p=>p.status==="Received"&&cj.some(j=>j.id===p.jobId)).map(p=>p.date)]
        .map(d=>new Date(d).getTime()).filter(t=>!isNaN(t));
      if(!ds.length)return null;
      const last=Math.max(...ds);
      if(last<cutoff)return null;
      return {id:c.id,name:clientDisplayName(c),email,last,askedAt:c.reviewRequestedAt||null};
    }).filter(Boolean).sort((a,b)=>b.last-a.last);
  },[clients,jobs,payments]);
  const openIt=()=>{
    const cutoff=Date.now()-NINETY;
    setSel(new Set(recent.filter(r=>!r.askedAt||new Date(r.askedAt).getTime()<cutoff).map(r=>r.id)));
    setDone(null);setProg(null);setOpen(true);
  };
  const toggle=id=>setSel(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const run=async()=>{
    const targets=recent.filter(r=>sel.has(r.id));
    if(!targets.length)return;
    setBusy(true);setDone(null);
    const failed=[];const okIds=[];let sent=0;
    const msg=`Thank you so much for choosing ${biz?.name||"us"}. If you have a moment, a quick Google review would mean the world to our small studio.`;
    for(let i=0;i<targets.length;i++){
      const t=targets[i];setProg({done:i,total:targets.length});
      try{
        const html=buildClientEmailHtml({biz,clientName:t.name,message:msg,reviewUrl});
        await sendClientEmail({to:t.email,replyTo:biz?.email||"",fromName:biz?.name||"Your jeweller",subject:`Thank you from ${biz?.name||"us"}`,html});
        sent++;okIds.push(t.id);
      }catch(e){failed.push(t.name);}
      await new Promise(r=>setTimeout(r,400));
    }
    if(okIds.length){const stamp=today();setClients(p=>{const n=p.map(c=>okIds.includes(c.id)?{...c,reviewRequestedAt:stamp}:c);persist(K.cl,n);return n;});}
    setProg({done:targets.length,total:targets.length});setDone({sent,failed});setBusy(false);
  };
  return <>
    <Btn sm ghost onClick={openIt}>{ICON_GOOGLE}Ask for Google reviews</Btn>
    {open&&<Modal title="Ask recent clients for a review" onClose={busy?()=>{}:()=>setOpen(false)}>
      {!reviewUrl
        ?<div style={{fontSize:14,color:INK,lineHeight:1.6}}>Add a <strong>Google review link</strong> in Settings first, then you can email your recent clients for a review.</div>
        :done
          ?<div style={{fontSize:14,lineHeight:1.7}}>
             <div style={{color:OK,fontWeight:700}}>✓ Sent {done.sent} review request{done.sent!==1?"s":""}.</div>
             {done.failed.length>0&&<div style={{color:WARN,marginTop:8}}>Couldn't send to {done.failed.length}: {done.failed.join(", ")}</div>}
             <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><Btn sm onClick={()=>setOpen(false)}>Done</Btn></div>
           </div>
          :<div>
             <div style={{fontSize:12.5,color:WG,lineHeight:1.55,marginBottom:12}}>Clients who have completed work with you in the last 90 days and have an email. Those asked recently start unticked. Each gets a short message with your <strong style={{color:INK}}>Review us on Google</strong> button.</div>
             {recent.length===0
               ?<div style={{color:WG,fontSize:14,padding:"10px 0"}}>No clients with completed work in the last 90 days.</div>
               :<div style={{maxHeight:320,overflowY:"auto",border:`1px solid ${BD}`,borderRadius:6}}>
                  {recent.map((r,i)=>(
                    <label key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:i<recent.length-1?`1px solid ${BD}`:"none",cursor:"pointer"}}>
                      <input type="checkbox" checked={sel.has(r.id)} onChange={()=>toggle(r.id)} style={{width:16,height:16,accentColor:GOLD,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:700,color:INK}}>{r.name}</div>
                        <div style={{fontSize:11.5,color:WG,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.email} · last {fmtDate(new Date(r.last).toISOString().slice(0,10))}</div>
                      </div>
                      {r.askedAt&&<span style={{fontSize:10,fontWeight:700,color:WG,background:PARCH,border:`1px solid ${BD}`,borderRadius:999,padding:"2px 8px",flexShrink:0}}>asked {fmtDate(r.askedAt)}</span>}
                    </label>
                  ))}
                </div>}
             {busy&&prog&&<div style={{fontSize:12.5,color:WG,marginTop:10}}>Sending {prog.done} of {prog.total}…</div>}
             <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:14}}>
               <div style={{fontSize:12.5,color:WG}}>{sel.size} selected</div>
               <div style={{display:"flex",gap:10}}>
                 <Btn sm ghost onClick={()=>setOpen(false)} disabled={busy}>Cancel</Btn>
                 <Btn sm onClick={run} disabled={busy||sel.size===0}>{busy?"Sending…":`Send to ${sel.size}`}</Btn>
               </div>
             </div>
           </div>}
    </Modal>}
  </>;
}
// "Ready for collection" banner + email notification. Shown on a job once its stage reaches
// "Ready for collection"; emails the client (trade account or retail) a link-free "your piece is
// ready" message via the same send-email edge function, and records readyNotifiedAt on the job.
function ReadyForCollectionCard({job,client,biz,setJobs,setClients}){
  const[open,setOpen]=useState(false);
  const[email,setEmail]=useState("");
  const[subject,setSubject]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[sent,setSent]=useState(false);
  const[err,setErr]=useState("");
  const trade=client?.accountType==="trade";
  const ref=jobRef(job);
  const who=trade?(client?.contactName||client?.name):clientDisplayName(client);
  const defSubject=`${job.type} ready for collection${trade?` (#${ref})`:""}`;
  const defMessage=trade
    ?`Job #${ref}${job.po?` (PO ${job.po})`:""}, ${job.type}, is finished and ready for collection.\n\nPlease contact us to arrange a time to collect it.`
    :`Good news, your ${job.type} is ready to collect.\n\nPlease contact us to arrange a time for collection.`;
  const openIt=()=>{setEmail(client?.email||"");setSubject(defSubject);setMessage(defMessage);setErr("");setSent(false);setOpen(true);};
  const send=async()=>{
    if(!email.trim()){setErr("Enter an email address.");return;}
    setBusy(true);setErr("");
    try{
      const html=buildClientEmailHtml({biz,clientName:who,message,reviewUrl:(biz?.googleReviewUrl||"").trim()});
      await sendClientEmail({to:email.trim(),replyTo:biz?.email||"",fromName:biz?.name||"Your jeweller",subject:subject.trim()||defSubject,html});
      setJobs(p=>{const n=p.map(j=>j.id===job.id?{...j,readyNotifiedAt:today(),readyNotifiedTo:email.trim()}:j);persist(K.jo,n);return n;});
      if((biz?.googleReviewUrl||"").trim()&&setClients&&client?.id)setClients(p=>{const n=p.map(c=>c.id===client.id?{...c,reviewRequestedAt:today()}:c);persist(K.cl,n);return n;});
      setSent(true);setTimeout(()=>setOpen(false),1400);
    }catch(e){setErr(e?.message||"Couldn't send the email.");}
    setBusy(false);
  };
  const notified=job.readyNotifiedAt;
  return <Card style={{border:`1px solid ${OK}66`,background:OK+"0C"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{minWidth:0}}>
        <div style={{fontWeight:800,fontSize:15,color:INK}}>📦 Ready for collection</div>
        <div style={{fontSize:13,color:WG,marginTop:3,lineHeight:1.5}}>
          {notified
            ?<>✓ {trade?"Account":"Client"} notified on <strong style={{color:INK}}>{fmtDate(job.readyNotifiedAt)}</strong>{job.readyNotifiedTo?<> · {job.readyNotifiedTo}</>:null}</>
            :client?.email
              ?<>Let {trade?"the account":clientDisplayName(client)} know their {trade?"job is":"piece is"} ready to pick up.</>
              :<>Add an email address to this client to notify them.</>}
        </div>
      </div>
      <Btn sm ghost onClick={openIt} disabled={!client?.email}>{notified?"Notify again":"✉️ Notify ready"}</Btn>
    </div>
    {open&&<Modal title="Notify — ready for collection" onClose={()=>setOpen(false)}>
      {sent
        ?<div style={{padding:"14px 2px",fontSize:14,color:OK,fontWeight:700}}>✓ Sent to {email}</div>
        :<div>
          <Input label="To" value={email} onChange={setEmail} placeholder="client@example.com"/>
          <Input label="Subject" value={subject} onChange={setSubject}/>
          <Input label="Message" value={message} onChange={setMessage} as="textarea" rows={5}/>
          <div style={{fontSize:12,color:WG,margin:"4px 0 14px",lineHeight:1.5}}>Sent from <strong style={{color:INK}}>{biz?.name||"your studio"}</strong>{biz?.email?`, replies go to ${biz.email}`:""}.{(biz?.googleReviewUrl||"").trim()?<> Your <strong style={{color:INK}}>Review us on Google</strong> button is included.</>:<> Add a Google review link in Settings to include a review button.</>}</div>
          {err&&<div style={{fontSize:13,color:DANGER,marginBottom:12,lineHeight:1.5}}>{err}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <Btn sm ghost onClick={()=>setOpen(false)}>Cancel</Btn>
            <Btn sm onClick={send} disabled={busy}>{busy?"Sending…":"Send notification"}</Btn>
          </div>
        </div>}
    </Modal>}
  </Card>;
}
const fmtR=n=>`${CUR_SYM}${Math.round(Number(n||0)).toLocaleString(LOCALE)}`;
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>d?new Date(d).toLocaleDateString(LOCALE,{day:"numeric",month:"short",year:"numeric"}):"—";
// ── Calendar helpers (local-time based, so "today" is correct in AU) ───────
const pad2=n=>String(n).padStart(2,"0");
const toISO=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const localToday=()=>toISO(new Date());
const parseISO=s=>{const[y,m,d]=String(s||"").split("-").map(Number);return new Date(y,(m||1)-1,d||1);};
const addDays=(s,n)=>{const d=parseISO(s);d.setDate(d.getDate()+n);return toISO(d);};
const addMonths=(s,n)=>{const d=parseISO(s);d.setMonth(d.getMonth()+n);return toISO(d);};
const startOfWeek=s=>{const d=parseISO(s);const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return toISO(d);}; // Monday
const fmtTime=t=>{if(!t)return"";const[h,m]=String(t).split(":").map(Number);if(isNaN(h))return"";const ap=h<12?"am":"pm";return`${h%12||12}:${pad2(m||0)}${ap}`;};
const fmtDayShort=s=>parseISO(s).toLocaleDateString(LOCALE,{weekday:"short",day:"numeric",month:"short"});
const monthLabel=s=>parseISO(s).toLocaleDateString(LOCALE,{month:"long",year:"numeric"});
const addMin=(t,min)=>{if(!t||!min)return"";const[h,m]=String(t).split(":").map(Number);if(isNaN(h))return"";const tot=h*60+m+Number(min);const hh=Math.floor((tot%1440)/60),mm=tot%60;return`${pad2(hh)}:${pad2(mm)}`;};
const APPT_TYPES=["Consultation","Engagement Ring","Wedding Ring","Custom Design","Jewellery Repair","Laser Engraving","Other"];
const APPT_COLORS={"Consultation":"#5E9078","Engagement Ring":"#A85D78","Wedding Ring":"#2D7A4F","Custom Design":"#96627C","Jewellery Repair":"#C47A2E","Laser Engraving":"#5E6B7A","Other":"#7A6C5D"};
const APPT_STATUSES=["Scheduled","Completed","No-show","Cancelled"];
const APPT_STATUS_COLORS={"Scheduled":WG,"Completed":OK,"No-show":DANGER,"Cancelled":WARN};
const DURATION_OPTS=[{value:"",label:"— No set length —"},{value:15,label:"15 min"},{value:30,label:"30 min"},{value:45,label:"45 min"},{value:60,label:"1 hour"},{value:90,label:"1.5 hours"},{value:120,label:"2 hours"}];
// "Live" appointments = still on the books (not resolved/cancelled)
const isLiveAppt=a=>!a.status||a.status==="Scheduled";

// ── Markup logic ──────────────────────────────────────────────────────────
// Threshold buffer (global): a cost within $_markupBuffer of the next bracket is
// bumped up to that bracket, so costs just under a boundary don't get the higher
// (cheaper-tier) multiplier. Set from business settings on load.
let _markupBuffer=0;
const setMarkupBuffer=v=>{_markupBuffer=Number(v)||0;};
// Quote price rounding (global): customer-facing quote prices are rounded to the
// nearest $_quoteRounding so totals don't land on odd figures like $4,587.
// 0 = off. Set from business settings on load. Manual quoted prices are never rounded.
let _quoteRounding=0;
const setQuoteRounding=v=>{_quoteRounding=Number(v)||0;};
const roundQ=n=>_quoteRounding>0?Math.round(n/_quoteRounding)*_quoteRounding:n;
const getMultiplier=(cost,table)=>{
  if(!cost||cost<=0)return null;
  return table.find(b=>cost>=b.low&&cost<=b.high)||null;
};
// Bracket lookup with the threshold buffer applied (falls back to the exact bracket).
const getBracket=(cost,table)=>{
  if(!cost||cost<=0)return null;
  return getMultiplier(cost+_markupBuffer,table)||getMultiplier(cost,table);
};
const lineCost=li=>Number(li.costLow)||Number(li.cost)||0;
// Per-line cost helpers (used by invoice + proposal views)
const lineCostLow=li=>Number(li.costLow)||Number(li.cost)||0;
const lineCostHigh=li=>Number(li.costHigh)||0;
const lineIsRange=li=>lineCostHigh(li)>lineCostLow(li);

// gstOnMarkup: trade/wholesale quotes add 10% GST across the whole taxable supply — on the
// manufacturing markup AND on at-cost (noMarkup) pass-through items — because trade multipliers are
// lean cost-plus figures that do NOT bake in GST the way retail multipliers do. Retail passes false
// and is unchanged. Stones are already GST-inclusive in both modes (calcStoneQuote).
const calcQuote=(items,table,overrideMult,gstOnMarkup)=>{
  // Accent stones set to follow the stone (centre-stone) markup are priced separately, not as jewellery.
  items=(items||[]).filter(i=>i.markupMode!=="natural"&&i.markupMode!=="lab");
  const mItems=items.filter(i=>!i.noMarkup);
  const fItems=items.filter(i=>i.noMarkup);
  const base=mItems.reduce((s,li)=>s+lineCost(li),0);
  const bracket=getBracket(base,table);
  const autoMult=bracket?.multiplier||1;
  // Per-quote manual override of the multiplier wins over the bracket when set (>0).
  const ov=Number(overrideMult)||0;
  const overridden=ov>0;
  const mult=overridden?ov:autoMult;
  const gstMult=gstOnMarkup?1+GST_RATE:1;                 // trade: +10% GST on the whole taxable supply
  const markupFinal=base*mult*gstMult;
  const flatCost=fItems.reduce((s,li)=>s+lineCost(li),0); // at-cost pass-through items (your cost)
  const flatTotal=flatCost*gstMult;                       // billed amount — trade adds GST on top of cost
  const hasFlatItems=fItems.length>0;
  // Round the customer-facing price (global rounding setting) — internals stay exact
  const finalLow=roundQ(markupFinal+flatTotal);
  const finalHigh=finalLow;
  const baseLow=base;const baseHigh=base;const isRange=false;
  const markupFinalLow=markupFinal;const markupFinalHigh=markupFinal;const flatHigh=flatTotal;
  return {base,baseLow,baseHigh,isRange,bracket,mult,autoMult,overridden,gstOnMarkup:!!gstOnMarkup,markupFinal,markupFinalLow,markupFinalHigh,flatCost,flatTotal,flatHigh,hasFlatItems,finalLow,finalHigh};
};

// Manual quoted price (verbal phone / in-person quotes): when q.manualTotal is set (>0)
// it IS the customer price (inc GST) and replaces the calculated grand total everywhere.
const quoteIsManual=q=>Number(q?.manualTotal)>0;
// A quote counts as invoiced if any invoice references it. Combined invoices list several ids in
// quoteIds; older single-quote invoices store one quoteId.
const quoteHasInvoice=(invoices,qid)=>(invoices||[]).some(i=>(i.quoteIds||(i.quoteId?[i.quoteId]:[])).includes(qid));
// Effective markup multiplier for a quote: a manual per-quote override wins; otherwise a
// trade-priced quote (pricingMode==="trade") uses its snapshot trade multiplier. Retail = 0
// (calcQuote then uses the auto bracket), so existing retail quotes are unchanged.
const effMarkupOverride=q=>{const mo=Number(q?.markupOverride)||0;if(mo>0)return mo;if(q?.pricingMode==="trade")return Number(q?.tradeMult)||0;return 0;};
// Grand total for a quote, inc GST — manual price wins; else jewellery + centre stone + stone-markup accents.
const quoteGrandTotal=(q,markupTable)=>{
  if(quoteIsManual(q))return Number(q.manualTotal);
  const c=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
  return (c.isRange?c.finalHigh:c.finalLow)+(q.stoneClientTotal||0)+(q.accentStoneTotal||0);
};
// Total agreed charge for a job, used by every financial view.
// Uses the manual Total Charge Override when set; otherwise sums approved quotes.
const jobChargeTotal=(job,quotes,markupTable,invoices)=>{
  const ov=Number(job?.totalOverride);
  const base=ov>0?ov:(quotes||[]).filter(q=>q.jobId===job.id&&q.status==="Approved").reduce((s,q)=>s+quoteGrandTotal(q,markupTable),0);
  // Subtract any discounts applied on this job's invoices so "amount owing" matches the billed total.
  const disc=(invoices||[]).filter(i=>i.jobId===job.id).reduce((s,i)=>s+(Number(i.discount)||0),0);
  return Math.max(0,base-disc);
};
// Sum of gold trade-in credits on a job's approved quotes. It's a credit RECEIVED (like paying in
// gold) — it does NOT reduce the sale price (jobChargeTotal), it's counted alongside payments.
const jobTradeInCredit=(job,quotes)=>(quotes||[]).filter(q=>q.jobId===job?.id&&q.status==="Approved").reduce((s,q)=>s+(Number(q.tradeInCredit)||0),0)+(Number(job?.repairTradeIn)||0);
// True if the job has any agreed charge (override or approved quote)
const jobHasCharge=(job,quotes)=>Number(job?.totalOverride)>0||(quotes||[]).some(q=>q.jobId===job.id&&q.status==="Approved");
// Effective invoice status for display/aggregation. A manual "Paid" always wins. Otherwise, when
// a job has a single invoice and its recorded payments cover the total, it auto-shows Paid.
// Payments link to the job (not the invoice), so we only auto-pay when it's unambiguous — a job
// with multiple invoices keeps its manual status to avoid crediting one payment against both.
const invoicePaidByPayments=(inv,payments,invoices)=>{
  if(!inv||inv.status==="Paid")return inv?.status==="Paid";
  if((invoices||[]).filter(i=>i.jobId===inv.jobId).length>1)return false;
  const paid=(payments||[]).filter(p=>p.jobId===inv.jobId&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  return Number(inv.totalIncGST)>0&&paid>=Number(inv.totalIncGST)-0.5;
};
const invoiceEffectiveStatus=(inv,payments,invoices)=>{
  if(inv?.status==="Paid")return "Paid";
  if(invoicePaidByPayments(inv,payments,invoices))return "Paid";
  return inv?.status||"Unpaid";
};
// Short reference for a quote: the user's title if set, otherwise the random #ID tag
const quoteRef=q=>"#"+(q?.id||"").slice(-4).toUpperCase();
const quoteLabel=q=>(q?.title&&q.title.trim())?q.title.trim():"Quote "+quoteRef(q);
// After invoicing quote(s) for a job, offer to decline the job's OTHER approved-but-uninvoiced quotes
// so leftover option copies (e.g. duplicated proposal options) don't keep inflating its outstanding
// balance — jobChargeTotal sums every Approved quote. Prompted, NOT automatic, because a job can
// legitimately have several approved quotes for separate pieces awaiting their own invoices.
const declineOrphanApprovedQuotes=(jobId,invoicedIds,quotes,invoices,setQuotes,markupTable)=>{
  if(!setQuotes||!jobId)return;
  const done=new Set(invoicedIds);
  const orphans=(quotes||[]).filter(q=>q.jobId===jobId&&q.status==="Approved"&&!done.has(q.id)&&!quoteHasInvoice(invoices,q.id));
  if(!orphans.length)return;
  const many=orphans.length>1;
  const list=orphans.map(q=>`• ${quoteLabel(q)} — ${fmt(quoteGrandTotal(q,markupTable))}`).join("\n");
  if(!confirm(`This job has ${orphans.length} other approved quote${many?"s":""} that ${many?"aren't":"isn't"} on any invoice:\n\n${list}\n\n${many?"They're":"It's"} still counted in the job's outstanding balance. Decline ${many?"them":"it"} so the balance matches what you've invoiced?\n\nOK = decline${many?" them":""} · Cancel = leave as is`))return;
  const drop=new Set(orphans.map(q=>q.id));
  setQuotes(p=>{const n=p.map(q=>drop.has(q.id)?{...q,status:"Declined"}:q);persist(K.qu,n);return n;});
};
// Copy of a quote as a fresh Draft — new id/date, "(copy)" appended to a set title, and
// any approval/invoice-linking state dropped so it's safe to edit independently.
const duplicateQuoteObj=q=>{
  const{updatedAt,...rest}=q||{};
  return{...rest,id:uid(),status:"Draft",createdAt:today(),
    title:(q?.title&&q.title.trim())?q.title.trim()+" (copy)":""};
};
// Combined client display name — "Jessica & Richard" when a partner is set, else the primary name.
const clientDisplayName=c=>{if(!c)return"";const p=(c.partnerName||"").trim();return p?`${c.name} & ${p}`:(c.name||"");};

// ── Storage ───────────────────────────────────────────────────────────────
// ── Stone quote calculation (cost → markup → tax) ────────────────────────
// Two per-studio modes for how tax meets the marked-up stone (STONE_TAX_INCLUSIVE):
//   • default (false): tax is ADDED ON TOP of the marked-up stone → client pays cost×mult×(1+rate).
//   • inclusive (true): the marked-up stone price ALREADY INCLUDES tax → client pays cost×mult,
//     and the tax component is backed out of that figure.
// Either way the returned clientTotal is tax-inclusive and markedUp+gst sum exactly to it.
const calcStoneQuote=(items,table,overrideMult)=>{
  const stones=items.filter(i=>Number(i.cost||i.costLow)>0);
  if(!stones.length)return null;
  const totalCost=stones.reduce((s,i)=>s+Number(i.cost||i.costLow||0),0);
  const bracket=(table||[]).find(b=>totalCost>=b.low&&totalCost<=b.high)||null;
  const autoMult=bracket?.multiplier||1;
  const ov=Number(overrideMult)||0;                 // per-quote manual multiplier (e.g. dial a big stone down)
  const mult=ov>0?ov:autoMult;
  // Round the final inclusive price (global rounding setting), then back out the tax
  // component so markedUp + gst still sum exactly to what the client pays.
  const taxMult=STONE_TAX_INCLUSIVE?1:(1+GST_RATE);  // inclusive → markup is already the client price
  const clientTotal=roundQ(totalCost*mult*taxMult);
  const gst=clientTotal-clientTotal/(1+GST_RATE);
  const markedUp=clientTotal-gst;
  return{totalCost,bracket,mult,autoMult,overridden:ov>0,markedUp,gst,clientTotal};
};

const K={cl:"jlr4_clients",jo:"jlr4_jobs",qu:"jlr4_quotes",pa:"jlr4_payments",pr:"jlr4_pricing_v9",biz:"jlr4_biz",no:"jlr4_notes",inv:"jlr4_invoices",spot:"jlr4_spot",mt:"jlr4_markup",smn:"jlr4_stone_nat",sml:"jlr4_stone_lab",csr:"jlr4_centre_rates",ap:"jlr4_appointments",pp:"jlr4_proposals",td:"jlr4_todos",st:"jlr4_stock",gc:"jlr4_gem_custody",delpr:"jlr4_deleted_pricing",tmt:"jlr4_trade_markup",tsmn:"jlr4_trade_stone_nat",tsml:"jlr4_trade_stone_lab"};

// Name of the public, anon-readable table holding immutable proposal snapshots for client links.
const PUBLIC_PROPOSALS_TABLE="public_proposals";
// Build the frozen client-facing snapshot from the chosen option quotes. Stored in the
// cloud at publish time so the client always sees exactly what was sent (no live data access).
// Turn a pasted video URL into a safe embed. We only ever build an <iframe> from a
// provider-normalised URL (never the raw user string); anything else becomes a plain link.
function videoEmbed(url){
  const u=(url||"").trim();
  if(!u)return null;
  try{
    let m=u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    if(m)return{type:"iframe",src:`https://www.youtube.com/embed/${m[1]}`,href:u};
    m=u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if(m)return{type:"iframe",src:`https://player.vimeo.com/video/${m[1]}`,href:u};
    m=u.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
    if(m)return{type:"iframe",src:`https://www.loom.com/embed/${m[1]}`,href:u};
    if(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(u))return{type:"video",src:u,href:u};
    return{type:"link",src:u,href:u};
  }catch(e){return{type:"link",src:u,href:u};}
}

// Build an invoice's content (line items, totals, trade-in) from a single quote. Shared by
// invoice creation and the "Update from quote" re-sync so the two always produce the same result.
const invoiceContentFromQuote=(q,job,markupTable)=>{
  const calc=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
  const totalIncGST=quoteGrandTotal(q,markupTable);
  const gst=totalIncGST-totalIncGST/(1+GST_RATE);
  const exGST=totalIncGST-gst;
  const descriptionOverride=q.clientDescription||job?.description||"";
  const lineItems=[...q.lineItems];
  const centreInc=q.stoneClientTotal||0;
  if(centreInc>0){
    const sDescs=(q.stoneItems||[]).map(s=>(s.description||"").trim()).filter(Boolean);
    const sDetails=(q.stoneItems||[]).map(s=>(s.detail||"").trim()).filter(Boolean);
    lineItems.push({id:uid(),description:sDescs.length?sDescs.join(" + "):(q.stoneType==="lab"?"Lab-grown":"Natural")+" diamond / gemstone",detail:sDetails.length?sDetails.join(" · "):"Supplied & set",costLow:centreInc.toFixed(2),noMarkup:true});
  }
  if(!lineItems.length)lineItems.push({id:uid(),description:quoteLabel(q),detail:"As quoted",costLow:totalIncGST.toFixed(2),noMarkup:true});
  return{exGST,gst,totalIncGST,lineItems,tradeInCredit:Number(q.tradeInCredit)||0,tradeInNote:q.tradeInNote||"",descriptionOverride,calc};
};

// Fresh line items for one quote on a combined invoice (incl. its centre stone, or a fallback
// line for manual-price quotes). Fresh ids so items from different quotes never collide.
const quoteInvoiceLineItems=(q,markupTable)=>{
  const lineItems=q.lineItems.map(li=>({...li,id:uid()}));
  const centreInc=q.stoneClientTotal||0;
  if(centreInc>0){
    const sDescs=(q.stoneItems||[]).map(s=>(s.description||"").trim()).filter(Boolean);
    const sDetails=(q.stoneItems||[]).map(s=>(s.detail||"").trim()).filter(Boolean);
    lineItems.push({id:uid(),description:sDescs.length?sDescs.join(" + "):(q.stoneType==="lab"?"Lab-grown":"Natural")+" diamond / gemstone",detail:sDetails.length?sDetails.join(" · "):"Supplied & set",costLow:centreInc.toFixed(2),noMarkup:true});
  }
  if(!lineItems.length)lineItems.push({id:uid(),description:quoteLabel(q),detail:"As quoted",costLow:quoteGrandTotal(q,markupTable).toFixed(2),noMarkup:true});
  return lineItems;
};
// Financial fields of an invoice, derived from its quotes (GST-inclusive model). Single source of
// truth shared by invoice creation AND re-sync after a quote edit, so the two can never diverge.
const invoiceFieldsFromQuotes=(qs,job,markupTable)=>{
  const totalIncGST=qs.reduce((s,q)=>s+quoteGrandTotal(q,markupTable),0);   // manual price wins per quote
  const gst=totalIncGST-totalIncGST/(1+GST_RATE);
  const exGST=totalIncGST-gst;
  const lineItems=qs.flatMap(q=>quoteInvoiceLineItems(q,markupTable));
  const descriptionOverride=qs.length===1
    ?(qs[0].clientDescription||job?.description||"")
    :(job?.description||qs.map(q=>q.clientDescription||quoteLabel(q)).filter(Boolean).join(" + "));
  const notes=qs.map(q=>q.notes).filter(Boolean).join("\n");
  const customerLines=qs.length>1?qs.map(q=>({id:uid(),description:(q.clientDescription||"").trim()||job?.description||quoteLabel(q),amount:quoteGrandTotal(q,markupTable)})):null;
  return{exGST,gst,totalIncGST,lineItems,notes,tradeInCredit:qs.reduce((s,q)=>s+(Number(q.tradeInCredit)||0),0),tradeInNote:qs.map(q=>(q.tradeInNote||"").trim()).filter(Boolean).join(" · "),descriptionOverride,customerLines};
};
// Build one invoice from one or more approved quotes on a job. For 2+ quotes it itemises per
// option (customerLines) so the client sees each piece and its price.
// Shared by the Invoices tab and the job card so both produce identical combined invoices.
const buildCombinedInvoice=(qs,job,invoices,markupTable,biz)=>
  ({id:uid(),jobId:job.id,quoteId:qs[0].id,quoteIds:qs.map(q=>q.id),number:nextInvoiceNumber(invoices,biz),date:today(),status:"Unpaid",...invoiceFieldsFromQuotes(qs,job,markupTable)});
// Re-derive an existing invoice's figures from its (just-edited) quotes. Keeps identity and
// history — id, number, date, status — and re-applies any manual discount onto the fresh gross
// (same net/GST model as setDiscount: subtotalIncGST = gross, totalIncGST = net of discount).
const resyncInvoiceWithQuotes=(inv,allQuotes,job,markupTable)=>{
  const ids=inv.quoteIds||(inv.quoteId?[inv.quoteId]:[]);
  const qs=ids.map(id=>allQuotes.find(q=>q.id===id)).filter(Boolean);
  if(!qs.length)return inv;   // quotes gone — leave the invoice untouched
  const fields=invoiceFieldsFromQuotes(qs,job,markupTable);   // fields.totalIncGST is the gross
  const sub=fields.totalIncGST;
  const disc=Math.min(Math.max(0,Number(inv.discount)||0),sub);
  const net=sub-disc;
  return{...inv,...fields,subtotalIncGST:sub,discount:disc,totalIncGST:net,gst:net-net/(1+GST_RATE)};
};

const buildProposalSnapshot=({proposal,job,client,biz,quotes,markupTable,payments,photoMap})=>{
  const validityDays=biz?.quoteValidityDays||30;
  const created=proposal.createdAt||today();
  const paidTotal=(payments||[]).filter(p=>p.jobId===job?.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const optPhotos=proposal.optionPhotos||{};
  const optVideos=proposal.optionVideos||{};
  const options=(proposal.optionIds||[]).map(qid=>{
    const q=quotes.find(x=>x.id===qid);
    if(!q)return null;
    const calc=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
    const priceKnown=quoteIsManual(q)||!(calc.base>0&&!calc.bracket&&!calc.overridden);
    // Chosen photo path(s) resolved to inline data URLs via photoMap at build time.
    // Back-compat: older proposals stored a single path string instead of an array.
    const sel=optPhotos[qid];
    const paths=Array.isArray(sel)?sel:(sel?[sel]:[]);
    const photos=paths.map(pp=>photoMap&&photoMap[pp]).filter(Boolean);
    return{
      id:q.id,
      label:quoteLabel(q),
      price:priceKnown?quoteGrandTotal(q,markupTable):null,
      description:q.clientDescription||job?.description||"",
      recommended:proposal.recommendedId===q.id,
      photo:photos[0]||null,   // back-compat: first image
      photos,
      video:optVideos[qid]||null,
      tradeIn:Number(q.tradeInCredit)||0,
      tradeInNote:q.tradeInNote||"",
    };
  }).filter(Boolean);
  return{
    kind:"proposal",
    biz:{name:biz?.name||"",logo:biz?.logo||"",phone:biz?.phone||"",email:biz?.email||"",abn:biz?.abn||"",address:biz?.address||""},
    clientName:clientDisplayName(client),
    jobType:job?.type||"Custom Jewellery",
    intro:proposal.intro||"",
    options,
    selectMode:proposal.selectMode==="multi"?"multi":"single",
    depositPercent:biz?.depositPercent||50,
    paidTotal,
    dueNow:proposal.dueNow??null,
    paymentNote:proposal.paymentNote||"",
    validUntil:addDays(String(created).slice(0,10),validityDays),
    terms:biz?.quoteTerms||"All custom jewellery requires a deposit before work commences. The final balance is due prior to collection. Quoted prices are valid for the period stated above. Price variations may apply if material costs change significantly. All pieces are handcrafted to order and cannot be returned unless faulty. Estimated completion times are indicative only.",
    createdAt:created,
  };
};

// Frozen client-facing snapshot of a tax invoice, stored alongside proposals in the
// same public table (kind:"invoice"). Re-written each time the link is shared so it
// reflects the invoice's current totals/balance.
const buildInvoiceSnapshot=({inv,job,client,biz,payments})=>{
  const paidTotal=(payments||[]).filter(p=>p.jobId===inv.jobId&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const invTradeIn=Number(inv.tradeInCredit)||0;const balance=Math.max(0,inv.totalIncGST-invTradeIn-paidTotal);
  const requestAmount=Number(inv.requestAmount)||0;
  const staged=requestAmount>0;
  const dueNow=staged?Math.max(0,Math.min(requestAmount-paidTotal-invTradeIn,balance)):balance;   // credit payments/trade-in against the staged deposit
  const remainingAfter=Math.max(0,balance-dueNow);
  return{
    kind:"invoice",
    biz:{name:biz?.name||"",logo:biz?.logo||"",phone:biz?.phone||"",email:biz?.email||"",abn:biz?.abn||"",address:biz?.address||"",
      bankName:biz?.bankName||"",bankAccountName:biz?.bankAccountName||biz?.name||"",bankBSB:biz?.bankBSB||"",bankAccount:biz?.bankAccount||"",
      paymentLink:biz?.paymentLink||""},
    clientName:clientDisplayName(client),
    number:inv.number,
    date:inv.date,
    jobType:job?.type||"",
    descriptionOverride:inv.descriptionOverride||"",
    customerLines:inv.customerLines||null,   // per-option breakdown for combined invoices
    subtotalIncGST:inv.subtotalIncGST??inv.totalIncGST,   // gross before discount
    discount:Number(inv.discount)||0,
    discountLabel:inv.discountLabel||"Discount",
    lineItems:(inv.lineItems||[]).map(li=>({description:li.description,detail:li.detail||"",amount:lineCostLow(li)})),
    gst:inv.gst,
    totalIncGST:inv.totalIncGST,
    tradeIn:invTradeIn,
    tradeInNote:inv.tradeInNote||"",
    paidTotal,
    balance,
    staged,
    dueNow,
    remainingAfter,
    asAt:today(),
  };
};

// ── Invoice CSV export (shared by the Invoices list range-export and single-invoice export) ──
const _csvCell=v=>{const s=String(v==null?"":v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
const invoiceCsvHeader=()=>["Invoice","Date","Customer","Description",`Subtotal (ex ${TAX_LABEL})`,TAX_LABEL,`Total (inc ${TAX_LABEL})`,"Trade-in credit","Amount received","Balance","Status"];
// Per-invoice paid/balance: distribute each job's received cash across its invoices oldest-first
// (payments are job-level), so figures reconcile with the summary tiles.
const invoicePaidBalanceMap=(invoices,payments)=>{
  const paidMap={},balMap={},byJob={};
  (invoices||[]).forEach(i=>{(byJob[i.jobId]=byJob[i.jobId]||[]).push(i);});
  Object.keys(byJob).forEach(jid=>{
    let cash=(payments||[]).filter(p=>p.jobId===jid&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
    byJob[jid].slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(inv=>{
      const gross=Number(inv.totalIncGST)||0,afterTradeIn=Math.max(0,gross-(Number(inv.tradeInCredit)||0));
      const cashApplied=Math.min(cash,afterTradeIn);cash-=cashApplied;
      balMap[inv.id]=Math.max(0,afterTradeIn-cashApplied);paidMap[inv.id]=gross-balMap[inv.id];
    });
  });
  return {paidMap,balMap};
};
const invoiceCsvRow=(inv,{jobs,clients,payments,allInvoices,paidMap,balMap})=>{
  const job=(jobs||[]).find(j=>j.id===inv.jobId),cl=job?(clients||[]).find(x=>x.id===job.clientId):null;
  const total=Number(inv.totalIncGST)||0,gst=Number(inv.gst)||0;
  const desc=(inv.descriptionOverride||job?.type||"").replace(/\s+/g," ").trim();
  return [inv.number,inv.date,cl?clientDisplayName(cl):"",desc,(total-gst).toFixed(2),gst.toFixed(2),total.toFixed(2),(Number(inv.tradeInCredit)||0).toFixed(2),(paidMap[inv.id]||0).toFixed(2),(balMap[inv.id]||0).toFixed(2),invoiceEffectiveStatus(inv,payments,allInvoices)];
};
const downloadInvoiceCsv=(rows,filename)=>{
  const csv="﻿"+[invoiceCsvHeader(),...rows].map(r=>r.map(_csvCell).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
};

// ── Trade statement billing (Phase 2) ─────────────────────────────────────
// Trade accounts want ONE consolidated statement per account, not an invoice per job. Everything
// below is derived on the fly from existing invoices + payments (no new persisted entity), and
// per-invoice outstanding always comes from invoicePaidBalanceMap so a statement can never
// disagree with the Invoices page. See [[project-invoice-model]] / [[project-future-features]].

// Account terms → whole days until an invoice falls due. Blank/EOM/unknown → null (handled below).
const termDays=(terms)=>{
  const t=String(terms||"").toLowerCase();
  if(t.startsWith("cod"))return 0;
  const m=t.match(/net\s*(\d+)/);
  return m?Number(m[1]):null;
};
// Due date (ISO) for one invoice given the account's terms. EOM = last day of the month FOLLOWING
// the invoice month (the standard trade "end-of-month account"); blank/unknown terms → due on issue.
const invoiceDueDate=(inv,client)=>{
  const base=String(inv?.date||"").slice(0,10);
  if(!base)return "";
  const terms=client?.terms||"";
  if(/eom/i.test(terms)){const d=parseISO(base);return toISO(new Date(d.getFullYear(),d.getMonth()+2,0));}
  const days=termDays(terms);
  return days==null?base:addDays(base,days);
};
// Aged-receivables buckets, oldest last. Keys are stable; labels are for display.
const AGE_BUCKETS=[["current","Current"],["d1_30","1–30 days"],["d31_60","31–60 days"],["d61_90","61–90 days"],["d90","90+ days"]];
const agingKey=(dueISO,asOf)=>{
  if(!dueISO)return "current";
  const days=Math.round((parseISO(asOf).getTime()-parseISO(dueISO).getTime())/86400000);
  if(days<=0)return "current";
  if(days<=30)return "d1_30";
  if(days<=60)return "d31_60";
  if(days<=90)return "d61_90";
  return "d90";
};
// The invoices + received payments that belong to one client's jobs (trade account activity).
const accountActivity=(client,jobs,invoices,payments)=>{
  const clientOf={};(jobs||[]).forEach(j=>{clientOf[j.id]=j.clientId;});
  const mine=jid=>clientOf[jid]===client?.id;
  return {
    jobOf:id=>(jobs||[]).find(j=>j.id===id),
    invoices:(invoices||[]).filter(i=>mine(i.jobId)),
    payments:(payments||[]).filter(p=>p.status==="Received"&&mine(p.jobId)),
  };
};
// Chronological account ledger: each invoice is a charge, its trade-in a same-day credit, each
// received payment a credit; running balance accumulates. Charges sort before credits on a day so
// a same-day payment reads as applied to that day's invoice.
const accountLedger=(client,jobs,invoices,payments)=>{
  const {invoices:accInv,payments:accPay,jobOf}=accountActivity(client,jobs,invoices,payments);
  const entries=[];
  accInv.forEach(inv=>{
    const job=jobOf(inv.jobId),d=String(inv.date||"").slice(0,10);
    entries.push({date:d,kind:"invoice",id:inv.id,ref:inv.number||"",desc:(inv.descriptionOverride||job?.type||"Invoice").replace(/\s+/g," ").trim(),po:job?.po||"",charge:Number(inv.totalIncGST)||0,credit:0,due:invoiceDueDate(inv,client)});
    const ti=Number(inv.tradeInCredit)||0;
    if(ti>0)entries.push({date:d,kind:"tradein",id:inv.id+"_ti",ref:inv.number||"",desc:"Trade-in credit"+(inv.tradeInNote?" · "+inv.tradeInNote:""),po:"",charge:0,credit:ti});
  });
  accPay.forEach(p=>entries.push({date:String(p.date||"").slice(0,10),kind:"payment",id:p.id,ref:"",desc:"Payment received"+(p.method?" · "+p.method:""),po:p.notes||"",charge:0,credit:Number(p.amount)||0}));
  const order={invoice:0,tradein:1,payment:2};
  entries.sort((a,b)=>String(a.date).localeCompare(String(b.date))||(order[a.kind]-order[b.kind]));
  let run=0;entries.forEach(e=>{run+=e.charge-e.credit;e.balance=run;});
  return {entries,balance:run,invoices:accInv,payments:accPay};
};
// Statement for a period: opening balance (all entries before `from`), the period's entries, and
// the closing balance. from/to are ISO (either may be blank for an open-ended statement).
const accountStatement=(client,jobs,invoices,payments,{from,to})=>{
  const {entries,balance}=accountLedger(client,jobs,invoices,payments);
  const opening=entries.filter(e=>from&&e.date<from).reduce((s,e)=>s+e.charge-e.credit,0);
  const period=entries.filter(e=>(!from||e.date>=from)&&(!to||e.date<=to));
  const closing=opening+period.reduce((s,e)=>s+e.charge-e.credit,0);
  return {opening,period,closing,balance};
};
// Aged analysis of the account's CURRENT outstanding, per-invoice balance from the shared
// distribution map so buckets sum to exactly the account balance shown on the Invoices page.
const accountAging=(client,jobs,invoices,payments,asOf)=>{
  const {invoices:accInv}=accountActivity(client,jobs,invoices,payments);
  const {balMap}=invoicePaidBalanceMap(invoices,payments);
  const buckets={current:0,d1_30:0,d31_60:0,d61_90:0,d90:0};
  accInv.forEach(inv=>{const b=Number(balMap[inv.id])||0;if(b>0)buckets[agingKey(invoiceDueDate(inv,client),asOf)]+=b;});
  return {buckets,total:Object.values(buckets).reduce((s,v)=>s+v,0)};
};
// Per-account business metrics for reporting: invoiced / collected / outstanding (all reconcile via
// invoicePaidBalanceMap), job volume, and average turnaround (dateIn→dateOut) in days over completed jobs.
const accountMetrics=(client,jobs,invoices,payments)=>{
  const {invoices:accInv}=accountActivity(client,jobs,invoices,payments);
  const {paidMap,balMap}=invoicePaidBalanceMap(invoices,payments);
  const invoiced=accInv.reduce((s,i)=>s+(Number(i.totalIncGST)||0),0);
  const collected=accInv.reduce((s,i)=>s+(Number(paidMap[i.id])||0),0);
  const outstanding=accInv.reduce((s,i)=>s+(Number(balMap[i.id])||0),0);
  const clientJobs=(jobs||[]).filter(j=>j.clientId===client?.id);
  const turns=clientJobs.map(j=>(j.dateIn&&j.dateOut)?Math.round((parseISO(j.dateOut).getTime()-parseISO(j.dateIn).getTime())/86400000):null).filter(d=>d!=null&&d>=0);
  const avgTurnaround=turns.length?Math.round(turns.reduce((s,d)=>s+d,0)/turns.length):null;
  return {invoiced,collected,outstanding,invoiceCount:accInv.length,jobCount:clientJobs.length,activeJobs:clientJobs.filter(j=>j.stage!=="Collected").length,completedCount:turns.length,avgTurnaround};
};
// Export a statement's ledger rows to CSV (same BOM/Excel handling as the invoice export).
const STATEMENT_CSV_HEADER=["Date","Type","Reference","Description","PO / ref","Charge","Credit","Balance"];
const downloadStatementCsv=(client,opening,period,closing,filename)=>{
  const rows=[["", "", "", "Opening balance","","","",opening.toFixed(2)]];
  period.forEach(e=>rows.push([e.date,e.kind==="invoice"?"Invoice":e.kind==="tradein"?"Trade-in":"Payment",e.ref||"",e.desc,e.po||"",e.charge?e.charge.toFixed(2):"",e.credit?e.credit.toFixed(2):"",e.balance.toFixed(2)]));
  rows.push(["","","","Closing balance owing","","","",closing.toFixed(2)]);
  const csv="﻿"+[STATEMENT_CSV_HEADER,...rows].map(r=>r.map(_csvCell).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
};
// Printable / Save-as-PDF statement of account, styled to match the app's other printouts (PCSS).
function printStatement(biz,client,{opening,period,closing,aging,from,to}){
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups so the statement can open in a new tab.");return;}
  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const bizName=esc(biz?.name||"Our Studio");
  const clientName=esc(clientDisplayName(client)||client?.name||"—");
  const contact=[client?.contactName,client?.email,client?.phone].filter(Boolean).map(esc).join(" · ");
  const periodLbl=from||to?`${from?fmtDate(from):"Start"} – ${to?fmtDate(to):"Today"}`:"All account activity";
  const dash=`<span style="color:#bbb">—</span>`;
  const money=n=>n?fmt(n):dash;
  const rows=period.length
    ?period.map(e=>`<tr>
<td class="muted" style="white-space:nowrap">${fmtDate(e.date)}</td>
<td class="desc">${esc(e.desc)}${e.ref?`<span class="muted"> · ${esc(e.ref)}</span>`:""}${e.po?`<div class="muted" style="font-size:10px">PO ${esc(e.po)}</div>`:""}${e.kind==="invoice"&&e.due?`<div class="muted" style="font-size:10px">Due ${fmtDate(e.due)}</div>`:""}</td>
<td class="right">${e.charge?fmt(e.charge):""}</td>
<td class="right" style="color:#2D7A4F">${e.credit?fmt(e.credit):""}</td>
<td class="right" style="font-weight:700">${fmt(e.balance)}</td>
</tr>`).join("")
    :`<tr><td colspan="5" style="color:#bbb;font-style:italic">No transactions in this period</td></tr>`;
  const agingCells=AGE_BUCKETS.map(([k,l])=>`<div class="cs-item"><div class="cs-lbl">${l}</div><div class="cs-val${k==="d90"&&aging.buckets[k]>0?" gold":""}">${fmt(aging.buckets[k])}</div></div>`).join("");
  win.document.write(`<!DOCTYPE html><html><head><title>Statement — ${clientName}</title><style>${PCSS}
.stbl{table-layout:fixed;margin:6px 0}
.stbl col.c-date{width:82px}.stbl col.c-chg{width:88px}.stbl col.c-pay{width:104px}.stbl col.c-bal{width:96px}
.stbl th,.stbl td{vertical-align:top;padding:10px 0 10px 14px}
.stbl th:first-child,.stbl td:first-child{padding-left:0}
.stbl th.right,.stbl td.right{text-align:right}
.stbl td.right{white-space:nowrap}
.stbl td.desc{line-height:1.5;word-break:break-word}
.stbl td.desc .muted{font-size:11px}
.balrow{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:#FAF7F2;border:1px solid #E8E2D9;border-radius:9px;margin-bottom:0}
.balrow.big{background:#1A1714;border-color:#1A1714;margin:14px 0 26px;padding:15px 18px}
.balrow .bl-l{font-size:11px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em}
.balrow.big .bl-l{color:#C9A84C}
.balrow .bl-v{font-size:16px;font-weight:800;color:#1A1714}
.balrow.big .bl-v{font-size:22px;color:#fff}
.aging{grid-template-columns:repeat(5,1fr)}
.terms-line{font-size:11px;color:#6B6560;margin-bottom:24px}
</style></head><body>
<div class="hdr">
  <div>${biz?.logo?`<img src="${esc(biz.logo)}" alt="${bizName}" style="max-width:180px;max-height:64px;object-fit:contain;display:block;margin-bottom:6px"/>`:`<div class="bname">${bizName}</div>`}<div class="bsub">${[biz?.email,biz?.phone,biz?.abn?TAX_ID_LABEL+" "+biz.abn:""].filter(Boolean).map(esc).join(" · ")}</div></div>
  <div><div class="qlbl">Statement of Account</div><div style="font-size:13px;color:#6B6560;text-align:right;margin-top:6px">${fmtDate(today())}</div></div>
</div>
<div class="to"><div class="tolbl">Account</div><div class="toname">${clientName}</div>${contact?`<div class="todet">${contact}</div>`:""}${client?.abn?`<div class="todet">${TAX_ID_LABEL} ${esc(client.abn)}</div>`:""}${client?.terms?`<div class="todet">Terms: ${esc(client.terms)}</div>`:""}</div>
<div class="terms-line">Statement period: <strong>${periodLbl}</strong></div>
<div class="balrow"><span class="bl-l">Opening balance</span><span class="bl-v">${fmt(opening)}</span></div>
<table class="stbl">
  <colgroup><col class="c-date"><col><col class="c-chg"><col class="c-pay"><col class="c-bal"></colgroup>
  <thead><tr><th>Date</th><th>Description</th><th class="right">Charges</th><th class="right">Payments / credits</th><th class="right">Balance</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="balrow big"><span class="bl-l">Closing balance owing</span><span class="bl-v">${fmt(closing)}</span></div>
<div class="cs-lbl" style="margin-bottom:8px">Aged receivables (as at ${fmtDate(today())})</div>
<div class="cost-summary aging">${agingCells}</div>
${biz?.paymentLink?`<div class="terms-line" style="margin-top:22px">Pay online: <strong>${esc(biz.paymentLink)}</strong></div>`:""}
<div class="footer">${bizName}${biz?.abn?" · "+TAX_ID_LABEL+" "+esc(biz.abn):""} — this statement supersedes any individual invoices for the period shown.</div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),400);
}

// Snapshot of a repair intake/receipt for the public client link (kind:"repair").
// items must already carry their customer-facing clientPrice (never the trade cost).
const buildRepairSnapshot=({job,client,biz,items,instructions,photos})=>({
  kind:"repair",
  biz:{name:biz?.name||"",logo:biz?.logo||"",phone:biz?.phone||"",email:biz?.email||"",abn:biz?.abn||"",address:biz?.address||""},
  clientName:clientDisplayName(client),
  ref:(job?.id||"").slice(-6).toUpperCase(),
  dateIn:job?.dateIn||"",
  dateOut:job?.dateOut||"",
  items:(items||[]).map(it=>({itemType:it.itemType||"",damage:it.damage||"",condition:it.condition||"",price:Number(it.clientPrice)||0})),
  total:(items||[]).reduce((s,it)=>s+(Number(it.clientPrice)||0),0),
  tradeIn:Number(job?.repairTradeIn)||0,
  tradeInNote:job?.repairTradeInNote||"",
  instructions:instructions||"",
  // Inline data URLs (not signed URLs) so they don't expire and need no auth to view.
  photos:(photos||[]).map(p=>({url:p.url,caption:p.caption||""})),
});

// ── Storage layer ───────────────────────────────────────────────────────────
// Three backends, chosen at runtime:
//  1. Supabase cloud table (when configured + logged in) → shared across computers
//  2. window.storage inside Claude artifacts
//  3. localStorage when run standalone in a browser (also the offline fallback)
const _useClaudeStorage=()=>{
  try{return typeof window!=='undefined'&&window.storage&&typeof window.storage.get==='function';}
  catch(e){return false;}
};
// When true, reads/writes go to Supabase. Toggled on once a user session exists.
let _cloudActive=false;
const setCloudActive=(v)=>{_cloudActive=v;};
// SAFETY: cloud writes are blocked until we've successfully READ the cloud once.
// This prevents a stale/empty boot (seed data) from overwriting good cloud data.
let _cloudLoaded=false;
const setCloudLoaded=(v)=>{_cloudLoaded=v;};
// The studio (tenant) the signed-in user belongs to. All cloud reads/writes are
// scoped to this id, so one studio can never see or overwrite another's data.
// Resolved from studio_members at login; null until known (blocks cloud writes).
let _studioId=null;
const setStudioIdModule=(v)=>{_studioId=v;};
// Capture a teammate invite token from the URL (…/?invite=<token>) as early as possible so it
// survives the sign-up + email-confirmation round-trip. accept_studio_invite() consumes it on
// first sign-in for a user who has no studio yet (see the studio-resolution effect).
try{const _iv=new URLSearchParams(window.location.search).get("invite");if(_iv)localStorage.setItem("pendingInvite",_iv);}catch(e){}

// ── Auto-update: reload when a newer deployment is live ──────────────────────
// Vite fingerprints the main bundle (…/assets/index-<hash>.js). Compare the hash we're RUNNING
// against the hash a freshly-fetched index.html points to; if they differ, a new version has
// shipped, so reload — no more manual Ctrl+Shift+R to pick up a deploy (e.g. after switching
// computers). No-op in dev (the Vite dev server serves no hashed bundle) and never reloads while
// a field is focused, and after reloading the running hash matches the latest, so it can't loop.
const RUNNING_BUNDLE=(()=>{try{
  const s=[...document.querySelectorAll("script[src]")].map(x=>x.getAttribute("src")||"").find(v=>/\/assets\/index-[A-Za-z0-9_-]+\.js/.test(v));
  const m=s&&s.match(/index-[A-Za-z0-9_-]+\.js/);return m?m[0]:null;
}catch(e){return null;}})();
async function checkForUpdate(){
  if(!RUNNING_BUNDLE)return;
  try{
    const res=await fetch(`/?_ts=${Date.now()}`,{cache:"no-store"});
    if(!res.ok)return;
    const html=await res.text();
    const m=html.match(/index-[A-Za-z0-9_-]+\.js/);
    const latest=m?m[0]:null;
    if(latest&&latest!==RUNNING_BUNDLE){
      const el=document.activeElement;
      const typing=el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable);
      if(!typing)location.reload();
    }
  }catch(e){}
}
// Per-key timestamp of THIS client's last cloud write. The realtime channel echoes
// our own writes back; without this we can re-apply a stale/older echo on top of
// fresh state and get stuck (e.g. wrong "balance owing" until the next reload).
const _lastWriteAt={};
// Strict cloud read — throws on error (no silent fallback) so the loader can tell
// the difference between "no data yet" (null) and "couldn't reach the cloud" (throw).
const _cloudGet=async(k)=>{
  const{data,error}=await supabase.from(STATE_TABLE).select("value").eq("studio_id",_studioId).eq("key",k).maybeSingle();
  if(error)throw error;
  return data?data.value:null;
};

// Local fallback keys are namespaced by studio so two studios sharing one browser
// can't read each other's offline copy. Falls back to "anon" before a studio is known.
const _localKey=(k)=>`${_studioId||"anon"}:${k}`;
const _localGet=async(k)=>{
  try{
    const nk=_localKey(k);
    if(_useClaudeStorage()){
      const r=await window.storage.get(nk);
      return(r&&r.value)?JSON.parse(r.value):null;
    }
    const v=localStorage.getItem(nk);
    return v?JSON.parse(v):null;
  }catch(e){return null;}
};
const _localSet=(k,v)=>{
  try{
    const nk=_localKey(k);
    if(_useClaudeStorage()){window.storage.set(nk,JSON.stringify(v)).catch(()=>{});}
    else{localStorage.setItem(nk,JSON.stringify(v));}
  }catch(e){}
};

const _storeGet=async(k)=>{
  if(_cloudActive&&supabase){
    try{
      const{data,error}=await supabase.from(STATE_TABLE).select("value").eq("studio_id",_studioId).eq("key",k).maybeSingle();
      if(error)throw error;
      return data?data.value:null;
    }catch(e){return await _localGet(k);}
  }
  return await _localGet(k);
};
// ── Concurrent-write protection (Stage 2) ──────────────────────────────────
// High-churn data keys are arrays of {id}. To stop one session's save clobbering a record another
// session added/edited (last-write-wins lost update), those keys read the latest cloud copy and
// 3-way merge by id before writing. Settings/catalogue keys keep the simple write.
const MERGE_KEYS=new Set([K.cl,K.jo,K.qu,K.pa,K.no,K.inv,K.ap,K.pp,K.st,K.gc]);
const _known={};        // last local value per key = the merge base (what this session last synced/wrote)
const _writeChain={};   // per-key promise chain so this client's own writes never race each other
const _byId=arr=>{const m={};(arr||[]).forEach(x=>{if(x&&x.id!=null)m[x.id]=x;});return m;};
const _sameRec=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// base = common ancestor (this session's last value); local = the change we want; remote = latest cloud.
const merge3=(base,local,remote)=>{
  const B=_byId(base),R=_byId(remote),out=[],seen=new Set();
  (local||[]).forEach(l=>{
    if(!l||l.id==null){out.push(l);return;}
    seen.add(l.id);const b=B[l.id],r=R[l.id];
    if(!b||!_sameRec(l,b)){out.push(l);return;}   // locally added or edited → local wins
    if(r!==undefined)out.push(r);                 // unchanged locally → take remote (its edits); drop if remote-deleted
  });
  (remote||[]).forEach(r=>{
    if(!r||r.id==null||seen.has(r.id))return;
    if(B[r.id]!==undefined)return;   // in base but not local → local deleted it → respect the delete
    out.push(r);                     // remote added it → keep
  });
  return out;
};
const _cloudUpsert=(k,v)=>{const ts=new Date().toISOString();_lastWriteAt[k]=ts;return supabase.from(STATE_TABLE).upsert({studio_id:_studioId,key:k,value:v,updated_at:ts},{onConflict:"studio_id,key"});};
// Serialized read-merge-write for a merge key, with OPTIMISTIC CONCURRENCY (Gap #1) so two clients
// saving the same key at almost the same instant can't silently lose an update. Each attempt reads
// {value,updated_at}, 3-way merges our change onto the latest cloud value, then writes CONDITIONALLY
// on updated_at being unchanged. If the row moved under us (another client committed in the gap), the
// conditional update touches 0 rows → we re-read and re-merge onto their value and retry. base = this
// session's last synced value (_known[k]); after a commit, base becomes the value we just wrote.
const _MERGE_RETRIES=4;
const _mergedWrite=(k,v)=>{
  const run=async()=>{
    for(let attempt=0;attempt<_MERGE_RETRIES;attempt++){
      try{
        const{data:row,error:readErr}=await supabase.from(STATE_TABLE).select("value,updated_at").eq("studio_id",_studioId).eq("key",k).maybeSingle();
        if(readErr)throw readErr;
        const ts=new Date().toISOString();
        if(!row){
          // First write for this key: insert. A concurrent insert trips the (studio_id,key) PK → retry as an update.
          const{error:insErr}=await supabase.from(STATE_TABLE).insert({studio_id:_studioId,key:k,value:v,updated_at:ts});
          if(insErr){if(insErr.code==="23505")continue;throw insErr;}
          _lastWriteAt[k]=ts;_known[k]=v;return;
        }
        const toWrite=(Array.isArray(row.value)&&Array.isArray(v))?merge3(Array.isArray(_known[k])?_known[k]:[],v,row.value):v;
        // Compare-and-set: only lands if updated_at still matches what we just read. .select() lets us
        // see how many rows were actually updated (0 = lost the race → loop and re-merge).
        const{data:upd,error:updErr}=await supabase.from(STATE_TABLE).update({value:toWrite,updated_at:ts}).eq("studio_id",_studioId).eq("key",k).eq("updated_at",row.updated_at).select("key");
        if(updErr)throw updErr;
        if(upd&&upd.length){_lastWriteAt[k]=ts;_known[k]=v;return;}   // won: our write landed
        // else 0 rows → someone wrote in the gap → loop, re-read, re-merge onto their value
      }catch(e){
        // Read/write failed (offline or transient) → best-effort blind upsert so the change isn't dropped; Stage-1 snapshots backstop.
        try{const{error}=await _cloudUpsert(k,v);if(error)console.warn("Cloud save failed for",k,error.message);}catch(_){}
        _known[k]=v;return;
      }
    }
    // Exhausted retries under sustained contention → last-resort merged upsert (still merges, just not conditional).
    try{
      const{data:row}=await supabase.from(STATE_TABLE).select("value").eq("studio_id",_studioId).eq("key",k).maybeSingle();
      const toWrite=(row&&Array.isArray(row.value)&&Array.isArray(v))?merge3(Array.isArray(_known[k])?_known[k]:[],v,row.value):v;
      const{error}=await _cloudUpsert(k,toWrite);if(error)console.warn("Cloud save failed for",k,error.message);
    }catch(e){}
    _known[k]=v;
  };
  _writeChain[k]=(_writeChain[k]||Promise.resolve()).then(run,run);
  return _writeChain[k];
};
const persist=(k,v)=>{
  // Always keep a local copy (offline resilience + instant reloads)
  _localSet(k,v);
  if(_cloudActive&&supabase){
    // SAFETY GUARD: never push to the cloud until we've confirmed a successful
    // cloud read this session. Stops a stale/seed boot from wiping real data.
    if(!_cloudLoaded){console.warn("Skipped cloud save for",k,"— cloud not loaded yet");return;}
    if(!_studioId){console.warn("Skipped cloud save for",k,"— no studio resolved yet");return;}
    if(MERGE_KEYS.has(k)){_mergedWrite(k,v);return;}   // merge-protected keys
    _known[k]=v;
    _cloudUpsert(k,v).then(({error})=>{if(error)console.warn("Cloud save failed for",k,error.message);});
  }
};

// ── Data-safety snapshots (Stage 1) ────────────────────────────────────────
// Rolling full-data backups so a lost/overwritten record is recoverable. Stored as ONE isolated
// row (key SNAP_KEY) holding an array of recent snapshots — it's never loaded into app state and
// only ever upserted, so it can't touch or corrupt the live data keys. RLS scopes it per studio.
const SNAP_KEY="__snapshots__";
const SNAP_CAP=12;
const _snapSummary=(d)=>({clients:(d?.[K.cl]||[]).length,jobs:(d?.[K.jo]||[]).length,quotes:(d?.[K.qu]||[]).length,invoices:(d?.[K.inv]||[]).length,payments:(d?.[K.pa]||[]).length});
// Write a snapshot: prepend to the rolling list, cap to SNAP_CAP, upsert. Returns the ISO ts or null.
const cloudSnapshot=async(data,reason)=>{
  if(!supabase||!_studioId||!_cloudLoaded||!data)return null;
  const ts=new Date().toISOString();
  let list=[];
  try{const{data:row}=await supabase.from(STATE_TABLE).select("value").eq("studio_id",_studioId).eq("key",SNAP_KEY).maybeSingle();if(row&&Array.isArray(row.value))list=row.value;}catch(e){}
  const next=[{ts,reason:reason||"auto",summary:_snapSummary(data),data},...list].slice(0,SNAP_CAP);
  const{error}=await supabase.from(STATE_TABLE).upsert({studio_id:_studioId,key:SNAP_KEY,value:next,updated_at:ts},{onConflict:"studio_id,key"});
  if(error){console.warn("Snapshot failed:",error.message);return null;}
  return ts;
};
const listCloudSnapshots=async()=>{
  if(!supabase||!_studioId)return [];
  try{const{data:row}=await supabase.from(STATE_TABLE).select("value").eq("studio_id",_studioId).eq("key",SNAP_KEY).maybeSingle();return(row&&Array.isArray(row.value))?row.value:[];}catch(e){return [];}
};

// ── Image storage (Supabase Storage, private bucket) ───────────────────────
const IMG_BUCKET="job-images";
const imagesEnabled=()=>Boolean(supabase&&_cloudActive);
// Resize + compress in the browser before upload (phone photos are huge)
const compressImage=(file,maxDim=1600,quality=0.82)=>new Promise((resolve,reject)=>{
  try{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let{width,height}=img;
        if(width>=height&&width>maxDim){height=Math.round(height*maxDim/width);width=maxDim;}
        else if(height>width&&height>maxDim){width=Math.round(width*maxDim/height);height=maxDim;}
        const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        canvas.toBlob(b=>b?resolve(b):reject(new Error("compress failed")),"image/jpeg",quality);
      };
      img.onerror=()=>reject(new Error("invalid image"));
      img.src=e.target.result;
    };
    reader.onerror=()=>reject(new Error("read failed"));
    reader.readAsDataURL(file);
  }catch(e){reject(e);}
});
// Logo → small PNG data URL (kept inline in biz settings; preserves transparency).
// Stored as a data URL so it prints reliably and needs no separate bucket.
const fileToLogoDataUrl=(file,maxDim=400)=>new Promise((resolve,reject)=>{
  try{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let{width,height}=img;
        if(width>=height&&width>maxDim){height=Math.round(height*maxDim/width);width=maxDim;}
        else if(height>width&&height>maxDim){width=Math.round(width*maxDim/height);height=maxDim;}
        const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror=()=>reject(new Error("invalid image"));
      img.src=e.target.result;
    };
    reader.onerror=()=>reject(new Error("read failed"));
    reader.readAsDataURL(file);
  }catch(e){reject(e);}
});
const uploadJobImage=async(jobId,blob)=>{
  // Scope new uploads under the studio so storage can be isolated per tenant.
  const path=`${_studioId?_studioId+"/":""}${jobId}/${uid()}.jpg`;
  const{error}=await supabase.storage.from(IMG_BUCKET).upload(path,blob,{contentType:"image/jpeg",upsert:false});
  if(error)throw error;
  return path;
};
const signedImageUrl=async(path)=>{
  try{
    const{data,error}=await supabase.storage.from(IMG_BUCKET).createSignedUrl(path,86400);
    if(error)throw error;
    return data?.signedUrl||null;
  }catch(e){return null;}
};
const deleteJobImage=async(path)=>{
  try{await supabase.storage.from(IMG_BUCKET).remove([path]);}catch(e){}
};
// Fetch a (signed) URL and inline it as a data URL so it prints/PDFs reliably
// without depending on a network round-trip while the print dialog is open.
const urlToDataUrl=async(url)=>{
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    return await new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result);
      r.onerror=()=>reject(new Error("read failed"));
      r.readAsDataURL(blob);
    });
  }catch(e){return null;}
};
// Pull a job's uploaded images in as inline data URLs, ready to embed in print docs.
const jobImagesForPrint=async(job,max=6)=>{
  const imgs=job?.images||[];
  if(!imagesEnabled()||!imgs.length)return[];
  const out=[];
  for(const img of imgs.slice(0,max)){
    const signed=await signedImageUrl(img.path);
    if(!signed)continue;
    const dataUrl=await urlToDataUrl(signed);
    out.push({path:img.path,url:dataUrl||signed,caption:img.caption||"",name:img.name||""});
  }
  return out;
};
// Resolve all of a job's images to a { path → inline data URL } map. Used to embed a chosen
// photo per proposal option without storing the (large) data URLs in app state.
const jobImageMap=async(job)=>{
  const map={};
  for(const p of await jobImagesForPrint(job,24))map[p.path]=p.url;
  return map;
};

// ── Shared UI ─────────────────────────────────────────────────────────────
const SS={inp:{width:"100%",padding:"11px 14px",borderRadius:10,border:`1px solid ${BD}`,fontSize:13,fontFamily:"inherit",color:INK,background:WHITE,outline:"none",boxSizing:"border-box",marginTop:4},lbl:{fontSize:10,fontWeight:700,color:INK,letterSpacing:"0.1em",textTransform:"uppercase",display:"block"}};


function StoneMarkupSummary({calc}){
  if(!calc)return null;
  if(!calc.bracket&&!calc.overridden)return <div style={{background:"#FFF3CD",border:"1px solid #F0C040",borderRadius:6,padding:"12px 16px",fontSize:13,color:WARN}}>Stone cost is outside your stone markup table range — check your table in Settings, or set a manual multiplier below.</div>;
  return <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:4,overflow:"hidden"}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",borderBottom:`1px solid ${BD}`}}>
      {[
        ["Your cost",fmt(calc.totalCost),WG],
        ["Bracket",calc.bracket?`${fmt(calc.bracket.low)}–${fmt(calc.bracket.high)}`:"—",WG],
        ["Markup",`${calc.mult}×${calc.overridden?" (override)":""}`,calc.overridden?GOLD:"#96627C"],
        ["Marked up",fmt(calc.markedUp),INK],
        [`+ ${TAX_LABEL} → Client`,fmtR(calc.clientTotal),OK],
      ].map(([l,v,col])=>(
        <div key={l} style={{padding:"12px 14px",borderRight:`1px solid ${BD}`}}>
          <div style={{fontSize:9,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{l}</div>
          <div style={{fontSize:15,fontWeight:800,color:col,letterSpacing:"-0.01em"}}>{v}</div>
        </div>
      ))}
    </div>
    {/* Profit / margin — internal only, so you can price big stones with confidence */}
    {(()=>{
      const profit=calc.markedUp-calc.totalCost;                       // gross profit, ex GST
      const margin=calc.markedUp>0?Math.round(profit/calc.markedUp*100):0;   // margin on the ex-GST sell price
      return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 14px",background:OK+"0E",borderBottom:`1px solid ${BD}`}}>
        <span style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Your profit on this stone <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(internal — excl. {TAX_LABEL})</span></span>
        <span style={{fontSize:13,color:INK}}><strong style={{color:OK,fontSize:15}}>{fmt(profit)}</strong> profit · <strong style={{color:INK}}>{margin}%</strong> margin · {calc.mult}× markup</span>
      </div>;
    })()}
    <div style={{padding:"8px 14px",fontSize:11,color:WG}}>Stone price shown to client: <strong style={{color:INK}}>{fmtR(calc.clientTotal)}</strong> ({STONE_TAX_INCLUSIVE?<>your cost {fmt(calc.totalCost)} × {calc.mult} markup, {TAX_LABEL} included ({fmt(calc.gst)})</>:<>your cost {fmt(calc.totalCost)} × {calc.mult} markup = {fmt(calc.markedUp)} + {Math.round(GST_RATE*100)}% {TAX_LABEL}</>})</div>
  </div>;
}

function Badge({label,color=WG,size="sm"}){
  return <span style={{display:"inline-block",padding:size==="lg"?"4px 14px":"2px 9px",borderRadius:3,fontSize:size==="lg"?12:11,fontWeight:700,letterSpacing:"0.04em",background:color+"22",color,border:`1px solid ${color}44`,whiteSpace:"nowrap"}}>{label}</span>;
}
function Btn({onClick,children,sm,xs,danger,ghost,disabled}){
  const[h,setH]=useState(false);
  // Soft-modern style: rounded, sentence-case, terracotta primary (matches workshoppilot.app).
  let bg,fg,bc;
  if(disabled){bg="#E3DAD0";fg=WHITE;bc="#E3DAD0";}
  else if(danger){bg=h?"#9A2D22":DANGER;fg=WHITE;bc=bg;}
  else if(ghost){bg=h?PARCH:WHITE;fg=INK;bc=h?GOLD:BD;}
  else{bg=h?GOLD_D:GOLD;fg=WHITE;bc=bg;}
  return <button onClick={disabled?undefined:onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} disabled={disabled}
    style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,background:bg,color:fg,border:`1px solid ${bc}`,borderRadius:10,padding:xs?"6px 13px":sm?"8px 17px":"11px 22px",fontSize:xs?11:sm?12.5:14,fontWeight:600,letterSpacing:"0.01em",cursor:disabled?"default":"pointer",fontFamily:"inherit",transition:"all 0.15s",opacity:disabled?0.6:1,whiteSpace:"nowrap"}}>{children}</button>;
}
function Input({label,value,onChange,type="text",placeholder,as,options,rows,min,step,disabled}){
  return <div style={{marginBottom:14}}>
    {label&&<label style={SS.lbl}>{label}</label>}
    {as==="select"?<select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} style={{...SS.inp,opacity:disabled?0.6:1}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>:as==="textarea"?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows||3} style={{...SS.inp,resize:"vertical"}}/>
    :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} step={step} disabled={disabled} style={{...SS.inp,opacity:disabled?0.6:1}}/>}
  </div>;
}
function Card({children,style={},onClick,id}){
  const[h,setH]=useState(false);
  return <div id={id} onClick={onClick} onMouseEnter={()=>onClick&&setH(true)} onMouseLeave={()=>setH(false)}
    style={{background:WHITE,borderRadius:RADIUS,border:`1px solid ${onClick&&h?"#D2D2D6":BD_SOFT}`,padding:"22px 26px",marginBottom:16,transition:"all 0.18s",cursor:onClick?"pointer":"default",boxShadow:onClick&&h?SHADOW_HV:SHADOW,transform:onClick&&h?"translateY(-2px)":"none",...style}}>{children}</div>;
}
function Modal({title,onClose,children,wide,footer,maxW}){
  const isMobile=useIsMobile();
  // Lock the page behind the modal so its scrollbar doesn't show alongside the modal's own, and the
  // background can't scroll under the backdrop. Restores the previous value on close (handles nesting).
  useEffect(()=>{const prev=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=prev;};},[]);
  // Padding on the overlay keeps the card off the screen edges, so the dark backdrop frames it on
  // all sides — the main visual cue that you're in a modal (without it, a full-width phone card
  // reads as just another page section). The card is a flex column: a pinned header, a scrolling
  // body (so the scrollbar lives inside the content, not on the card edge), and an optional pinned
  // footer for actions that must stay reachable in long modals.
  const px=isMobile?20:34;
  return <div style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.62)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(3px)",padding:isMobile?16:24,boxSizing:"border-box"}}>
    <div style={{background:WHITE,borderRadius:isMobile?16:18,width:"100%",maxWidth:maxW||(wide?860:580),maxHeight:isMobile?"90vh":"92vh",display:"flex",flexDirection:"column",overflow:"hidden",border:`1px solid ${BD}`,boxShadow:"0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.18)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:`${isMobile?15:17}px ${px}px`,borderBottom:`1px solid ${BD}`,flexShrink:0}}>
        <h2 style={{margin:0,fontSize:isMobile?17:19,fontWeight:800,color:INK,minWidth:0}}>{title}</h2>
        <button onClick={onClose} aria-label="Close" style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:9,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,cursor:"pointer",color:WG,lineHeight:1,padding:0,flexShrink:0}}>×</button>
      </div>
      <div style={{overflowY:"auto",overflowX:"hidden",flex:"1 1 auto",padding:`${isMobile?20:26}px ${px}px`}}>{children}</div>
      {footer&&<div style={{flexShrink:0,borderTop:`1px solid ${BD}`,background:WHITE,padding:`${isMobile?12:14}px ${px}px`}}>{footer}</div>}
    </div>
  </div>;
}
function SectionHeader({eyebrow,title,subtitle,action}){
  // Matches the dashboard header: uppercase eyebrow · big bold title · description line.
  return <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:24}}>
    <div style={{minWidth:0}}>
      {eyebrow&&<div style={{fontSize:11,fontWeight:700,color:WG,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>{eyebrow}</div>}
      <h1 style={{margin:0,fontSize:32,fontWeight:700,color:INK,letterSpacing:"-0.02em",fontFamily:"'Poppins',sans-serif"}}>{title}</h1>
      {subtitle&&<div style={{color:INK,fontSize:15,marginTop:6,lineHeight:1.5}}>{subtitle}</div>}
    </div>
    {action}
  </div>;
}
function Stat({label,value,accent,sub,onClick,tint,icon,trend}){
  const[h,setH]=useState(false);
  const isMobile=useIsMobile();
  const t=tint?TINTS[tint]:null;
  return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{background:t?t.bg:WHITE,border:`1px solid ${t?"transparent":(accent?GOLD+"66":BD_SOFT)}`,borderRadius:RADIUS,padding:isMobile?"14px 14px":"18px 20px",cursor:onClick?"pointer":"default",transition:"all 0.18s",boxShadow:h?SHADOW_HV:SHADOW,transform:onClick&&h?"translateY(-2px)":"none",minWidth:0}}>
    {icon&&<div style={{width:isMobile?32:40,height:isMobile?32:40,borderRadius:isMobile?10:13,background:t?t.ring:GOLD_L,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?16:19,marginBottom:isMobile?9:14,color:t?t.fg:GOLD_D}}>{icon}</div>}
    <div style={{display:"flex",alignItems:"baseline",gap:7,flexWrap:"wrap"}}>
      <div style={{fontSize:isMobile?20:27,fontWeight:800,color:t?t.fg:(accent?GOLD:INK),letterSpacing:"-0.02em",lineHeight:1.1,overflowWrap:"anywhere"}}>{value}</div>
      {trend}
    </div>
    <div style={{fontSize:11,color:t?t.fg:WG,opacity:t?0.85:1,fontWeight:700,marginTop:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    {sub&&<div style={{fontSize:11,color:t?t.fg:WG,opacity:t?0.7:1,marginTop:2}}>{sub}</div>}
  </div>;
}

// ── Markup summary box (reused in builder + detail) ───────────────────────
function MarkupSummary({baseLow,baseHigh,isRange,bracket,mult,autoMult,overridden,gstOnMarkup,markupFinalLow,markupFinalHigh,flatTotal,flatHigh,hasFlatItems,finalLow,finalHigh,large}){
  // Backwards compat: if markupFinalLow not passed, use finalLow (old call sites)
  const mfLow=markupFinalLow!==undefined?markupFinalLow:finalLow;
  const mfHigh=markupFinalHigh!==undefined?markupFinalHigh:finalHigh;
  const hasFlat=hasFlatItems&&flatTotal>0;
  // No bracket AND no manual override = genuinely can't price → warn.
  if(!bracket&&!overridden&&baseLow>0)return <div style={{background:"#FFF3CD",border:"1px solid #F0C040",borderRadius:4,padding:"12px 16px",fontSize:13,color:WARN}}>Base cost is outside your markup table range — set a manual markup multiplier below, or check your table in Settings.</div>;
  if(!bracket&&!overridden&&baseLow===0&&!hasFlat)return null;
  return <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:4,overflow:"hidden"}}>
    <div style={{display:"grid",gridTemplateColumns:hasFlat?"1fr 1fr 1fr 1fr 1fr":"1fr 1fr 1fr 1fr",borderBottom:hasFlat?`1px solid ${BD}`:"none"}}>
      {[
        ["Base cost",baseLow>0?fmt(baseLow):"—",WG],
        ["Bracket",bracket?`${fmt(bracket.low)} – ${fmt(bracket.high)}`:"—",WG],
        ["Multiplier",(bracket||overridden)?`${mult}×${overridden?" (override)":""}${gstOnMarkup?" +GST":""}`:"—",overridden?GOLD:GOLD_D],
        ["Markup total",baseLow>0?`${fmtR(mfLow)}${gstOnMarkup?"*":""}`:"—",hasFlat?INK:OK],
        ...(hasFlat?[["+ Flat fees",`${fmt(flatTotal)}${gstOnMarkup?"*":""}`,"#96627C"]]:
          []),
      ].map(([l,v,col])=>(
        <div key={l} style={{padding:"14px 16px",borderRight:`1px solid ${BD}`}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{l}</div>
          <div style={{fontSize:large?18:15,fontWeight:800,color:col,letterSpacing:"-0.01em"}}>{v}</div>
        </div>
      ))}
    </div>
    {gstOnMarkup&&((baseLow>0&&(bracket||overridden))||hasFlat)&&<div style={{padding:"9px 16px",fontSize:11,color:WG,borderTop:`1px solid ${BD}`,background:WHITE}}>* Trade pricing — {Math.round(GST_RATE*100)}% {TAX_LABEL} added across the supply.{baseLow>0&&(bracket||overridden)?<> Markup: {fmt(baseLow)} × {mult} × {(1+GST_RATE).toFixed(2)} = <strong style={{color:INK}}>{fmtR(mfLow)}</strong>.</>:null}{hasFlat?<> At-cost items include {TAX_LABEL} on top of cost.</>:null}</div>}
    {/* Profit / margin on the marked-up jewellery — internal only. GST (baked into the retail
        multiplier, or added explicitly for trade) is backed out for a true profit; no-markup
        (flat) items are pass-through and excluded. */}
    {baseLow>0&&(bracket||overridden)&&(()=>{
      const exGstSell=mfLow/(1+GST_RATE);              // ex-GST value of the marked-up portion
      const profit=exGstSell-baseLow;
      const margin=exGstSell>0?Math.round(profit/exGstSell*100):0;
      return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 16px",background:OK+"0E",borderTop:`1px solid ${BD}`}}>
        <span style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Your profit on the jewellery <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(internal — excl. {TAX_LABEL}{hasFlat?"; no-markup items at cost":""})</span></span>
        <span style={{fontSize:13,color:INK}}><strong style={{color:OK,fontSize:15}}>{fmt(profit)}</strong> profit · <strong style={{color:INK}}>{margin}%</strong> margin · {mult}× markup</span>
      </div>;
    })()}
    {hasFlat&&<div style={{display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center",padding:"12px 16px",background:WHITE,gap:12}}>
      <div style={{fontSize:11,color:WG}}>
        Markup total <strong style={{color:INK}}>{fmtR(mfLow)}</strong> + flat fees <strong style={{color:"#96627C"}}>{fmt(flatTotal)}</strong>
      </div>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Setting total</div>
        <div style={{fontSize:large?22:18,fontWeight:800,color:OK}}>{fmtR(finalLow)}</div>
      </div>
    </div>}
  </div>;
}

// ── Print CSS ─────────────────────────────────────────────────────────────
const PCSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Poppins',sans-serif;color:#1A1714;background:#fff;padding:48px 56px;max-width:820px;margin:0 auto}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:20px;border-bottom:2.5px solid #C9A84C}.bname{font-size:22px;font-weight:700}.bsub{font-size:12px;color:#6B6560;margin-top:3px}.qlbl{font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:.12em;text-transform:uppercase;text-align:right}.qnum{font-size:26px;font-weight:800;text-align:right}.to{margin-bottom:28px}.tolbl{font-size:10px;font-weight:700;color:#6B6560;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}.toname{font-size:17px;font-weight:700}.todet{font-size:12px;color:#6B6560;margin-top:2px}.desc-box{font-size:13px;line-height:1.7;margin-bottom:26px;padding:13px 17px;background:#FAF7F2;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{font-size:10px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.05em;padding:7px 0;border-bottom:2px solid #E8E2D9;text-align:left}td{padding:8px 0;font-size:12px;border-bottom:1px solid #E8E2D9}.right{text-align:right}.muted{color:#6B6560}.cost-summary{background:#FAF7F2;border:1px solid #E8E2D9;border-radius:10px;padding:16px 20px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}.cs-item{}.cs-lbl{font-size:9px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.cs-val{font-size:15px;font-weight:800;color:#1A1714}.cs-val.gold{color:#8B6914}.cs-val.green{color:#2D7A4F}.notes{font-size:12px;color:#6B6560;font-style:italic;padding:13px 17px;background:#FAF7F2;border-radius:8px;margin-bottom:20px;line-height:1.6}.valid{font-size:11px;color:#6B6560;margin-bottom:32px}.approval{border:1px solid #E8E2D9;border-radius:10px;padding:18px 22px;margin-top:32px}.aplbl{font-size:10px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}.apbody{font-size:12px;color:#6B6560;margin-bottom:16px;line-height:1.6}.sigrow{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:12px}.sigline{border-bottom:1px solid #1A1714;margin-top:26px;margin-bottom:4px}.siglbl{font-size:10px;color:#6B6560}.footer{margin-top:40px;padding-top:13px;border-top:1px solid #E8E2D9;font-size:10px;color:#6B6560;text-align:center}@media print{body{padding:28px 36px}}`;

function printProposalDoc(biz,c,job,q,calc){console.log('Print proposal (disabled in preview)');return;
  const win=window.open("","_blank");
  const rows=q.lineItems.map(li=>{
    const isR=lineIsRange(li);
    const costStr=isR?`approx ${fmt(lineCostLow(li))} – ${fmt(lineCostHigh(li))}`:fmt(lineCostLow(li));
    return `<tr><td>${li.description}</td><td class="muted">${li.detail||""}</td><td class="right">${costStr}</td></tr>`;
  }).join("");
  const isR=calc.isRange;
  win.document.write(`<!DOCTYPE html><html><head><title>Quote #${q.id.slice(-4).toUpperCase()}</title><style>${PCSS}</style></head><body>
<div class="hdr">
  <div><div class="bname">${biz.name||"Your Jewellery Studio"}</div><div class="bsub">${[biz.email,biz.phone].filter(Boolean).join(" · ")}</div></div>
  <div><div class="qlbl">Quote</div><div class="qnum">#${q.id.slice(-4).toUpperCase()}</div><div style="font-size:11px;color:#6B6560;text-align:right;margin-top:3px">${fmtDate(q.createdAt)}</div></div>
</div>
<div class="to"><div class="tolbl">Prepared for</div><div class="toname">${esc(clientDisplayName(c)||"Client")}</div><div class="todet">${[c?.email,c?.phone].filter(Boolean).join(" · ")}</div></div>
${job?.description?`<div class="desc-box"><strong>${job.type}</strong><br>${job.description}</div>`:""}
<table>
  <thead><tr><th>Description</th><th>Detail</th><th class="right">Cost</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="cost-summary">
  <div class="cs-item"><div class="cs-lbl">Base cost</div><div class="cs-val">${isR?`${fmt(calc.baseLow)} –`:""} ${fmt(isR?calc.baseHigh:calc.baseLow)}</div></div>
  <div class="cs-item"><div class="cs-lbl">Bracket</div><div class="cs-val">${fmt(calc.bracket.low)} – ${fmt(calc.bracket.high)}</div></div>
  <div class="cs-item"><div class="cs-lbl">Multiplier</div><div class="cs-val gold">${calc.mult}×</div></div>
  <div class="cs-item"><div class="cs-lbl">Your price</div><div class="cs-val green">${isR?`${fmtR(calc.finalLow)} – ${fmtR(calc.finalHigh)}`:fmtR(calc.finalLow)}</div></div>
</div>
${q.notes?`<div class="notes">${q.notes}</div>`:""}
${q.validUntil?`<div class="valid">This quote is valid until ${fmtDate(q.validUntil)}. Prices may change after this date.</div>`:""}
<div class="approval">
  <div class="aplbl">Client approval</div>
  <div class="apbody">By signing below, I confirm I have reviewed and approve this quote and understand that a deposit is required to proceed with production.</div>
  <div class="sigrow"><div><div class="sigline"></div><div class="siglbl">Client signature</div></div><div><div class="sigline"></div><div class="siglbl">Date</div></div></div>
</div>
<div class="footer">${biz.name||"Your Jewellery Studio"}${biz.abn?" · "+TAX_ID_LABEL+" "+biz.abn:""}</div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),400);
}

// Normalise intake to a list of items, migrating the old single-item shape.
function intakeItems(intake){
  intake=intake||{};
  if(Array.isArray(intake.items))return intake.items;
  if(intake.itemType||intake.damage||intake.condition)return[{itemType:intake.itemType||"",damage:intake.damage||"",condition:intake.condition||""}];
  return[];
}
// ── Job dockets & labels (Phase 3) ────────────────────────────────────────
// Self-contained Code 128 (subset B) barcode generator — no external libs. Table validated by the
// module-count invariant (every symbol = 11 modules, stop = 13) + round-trip decode. Encodes the
// short job ref so the printed docket/tag can be scanned back to the job later.
const C128=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
const code128b=text=>{
  const bytes=[...String(text||"")].map(c=>c.charCodeAt(0)).filter(c=>c>=32&&c<=126);
  if(!bytes.length)return "";
  const codes=[104,...bytes.map(c=>c-32)];
  let sum=104;codes.slice(1).forEach((v,i)=>{sum+=(i+1)*v;});
  codes.push(sum%103,106);
  return codes.map(c=>C128[c]).join("");
};
// SVG barcode as an HTML string (crisp, black-on-white). mw=module width (px), h=bar height.
const barcodeSvg=(text,{h=46,mw=2,quiet=10}={})=>{
  const widths=code128b(text);
  if(!widths)return "";
  const seq=[...widths].map(Number);
  let x=quiet*mw,bar=true,rects="";
  seq.forEach(d=>{if(bar)rects+=`<rect x="${x}" y="0" width="${d*mw}" height="${h}"/>`;x+=d*mw;bar=!bar;});
  const w=x+quiet*mw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><rect width="${w}" height="${h}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
};
// Short, human-readable job reference (also what the barcode encodes).
const jobRef=job=>(job?.id||"").slice(-6).toUpperCase();
// Per-piece codes so a batch job can be labelled piece by piece: jobRef + a 2-digit index
// (e.g. A1B2C3-01). Repairs → one per intake item; any other job → one per quote. Scanning any
// piece still resolves to the parent job because they share the jobRef prefix.
const pieceCode=(ref,i)=>`${ref}-${String(i+1).padStart(2,"0")}`;
function jobPieces(job,quotes){
  const ref=jobRef(job);
  if(job?.type==="Repair"){
    return intakeItems(job.intake||{}).map((it,i)=>({
      code:pieceCode(ref,i),
      title:(it.itemType||"").trim()||"Repair",
      sub:[it.damage,it.condition].filter(Boolean).join(" · "),
    }));
  }
  // Declined quotes are dead options, not pieces — skip them so they don't get a label/code.
  return (quotes||[]).filter(q=>q.jobId===job?.id&&q.status!=="Declined").map((q,i)=>({
    code:pieceCode(ref,i),
    title:(q.pieceTitle||q.title||"").trim()||quoteLabel(q),
    sub:(q.clientDescription||"").trim(),
  }));
}

// Internal workshop docket for the physical job envelope: barcode + docket #, client/PO, dates,
// instructions and a stage checklist. Never shows pricing — this rides with the job, not the client.
function printJobDocket(biz,c,job,quotes){
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups so the docket can open in a new tab.");return;}
  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const ml=s=>esc(s).replace(/\n/g,"<br>");
  const ref=jobRef(job);
  const pieces=jobPieces(job,quotes);
  const trade=c?.accountType==="trade";
  const clientName=esc(clientDisplayName(c)||"—");
  const contact=[trade?c?.contactName:"",c?.phone,c?.email].filter(Boolean).map(esc).join(" · ");
  const intake=job.type==="Repair"?(job.intake||{}):null;
  const instructions=intake?[...intakeItems(intake).map(it=>[it.itemType,it.damage].filter(Boolean).join(" — ")),intake.instructions].filter(Boolean).join("\n"):(job.notes||"");
  const idRow=(l,v)=>`<div class="idrow"><span class="idl">${l}</span><span class="idv">${v||"—"}</span></div>`;
  const stageBoxes=JOB_STAGES.map(s=>`<span class="stg${s===job.stage?" on":""}">${s===job.stage?"☑":"☐"} ${esc(s)}</span>`).join("");
  win.document.write(`<!DOCTYPE html><html><head><title>Job Docket — ${ref}</title><style>${PCSS}
.dhead{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2.5px solid #C9A84C;padding-bottom:16px;margin-bottom:20px}
.barc{margin-bottom:22px;text-align:center;border:1px solid #E8E2D9;border-radius:10px;padding:16px}
.barc svg{max-width:100%;height:auto}
.dref{font-size:30px;font-weight:800;letter-spacing:.05em;margin-top:8px}
.block{border:1px solid #E8E2D9;border-radius:10px;padding:14px 18px;margin-bottom:16px}
.idrow{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid #F0EBE3;font-size:13px}
.idrow:last-child{border-bottom:none}
.idl{color:#6B6560;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.08em;padding-top:2px}
.idv{color:#1A1714;font-weight:700;text-align:right}
.idv.po{color:#8B6914;font-size:15px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E8E2D9;border:1px solid #E8E2D9;border-radius:10px;overflow:hidden;margin-bottom:16px}
.grid4>div{background:#fff;padding:11px 14px}
.g-l{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
.g-v{font-size:13px;font-weight:700;color:#1A1714}
.instr{font-size:12.5px;line-height:1.6;color:#1A1714;background:#FAF7F2;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px;white-space:pre-line}
.stlbl{font-size:9px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px}
.stgs{display:flex;flex-wrap:wrap;gap:7px 16px;margin-bottom:22px}
.stg{font-size:11.5px;color:#6B6560}
.stg.on{color:#1A1714;font-weight:800}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:10px}
.sig .sigline{border-bottom:1px solid #1A1714;margin-top:26px;margin-bottom:5px}
.sig .siglbl{font-size:9px;color:#6B6560}
@media print{.block,.grid4,.barc{page-break-inside:avoid}}
</style></head><body>
<div class="dhead">
  <div>${biz.logo?`<img src="${esc(biz.logo)}" alt="${esc(biz.name||"")}" style="max-width:170px;max-height:56px;object-fit:contain;display:block;margin-bottom:5px"/>`:`<div class="bname">${esc(biz.name||"Our Studio")}</div>`}<div class="bsub">Workshop job docket${trade?" · Trade":""}</div></div>
  <div style="text-align:right"><div class="qlbl">Docket</div><div style="font-size:11px;color:#6B6560;margin-top:4px">Printed ${fmtDate(today())}</div></div>
</div>
<div class="barc">${barcodeSvg(ref,{h:60,mw:2.4})}<div class="dref">#${ref}</div></div>
<div class="block">
  ${idRow("Client",clientName)}
  ${contact?idRow("Contact",esc(contact)):""}
  ${trade||job.po?idRow("PO / reference",`<span class="idv po">${esc(job.po||"—")}</span>`):""}
</div>
<div class="grid4">
  <div><div class="g-l">Job</div><div class="g-v">${esc(job.type||"—")}</div></div>
  <div><div class="g-l">Taken in</div><div class="g-v">${job.dateIn?fmtDate(job.dateIn):"—"}</div></div>
  <div><div class="g-l">Due</div><div class="g-v">${job.deadline?fmtDate(job.deadline):"—"}</div></div>
  <div><div class="g-l">Pickup</div><div class="g-v">${job.dateOut?fmtDate(job.dateOut):"—"}</div></div>
</div>
${job.description?`<div class="instr"><strong>Job:</strong> ${ml(job.description)}</div>`:""}
${instructions?`<div class="instr"><strong>Instructions:</strong>\n${ml(instructions)}</div>`:""}
${pieces.length>1?`<div class="stlbl">Pieces (${pieces.length}) — one label per piece</div><div class="block" style="padding:4px 0;margin-bottom:16px">${pieces.map(p=>`<div class="idrow" style="padding:8px 16px"><span class="idl" style="padding-top:1px;letter-spacing:.06em">${esc(p.code)}</span><span class="idv" style="font-weight:600">${esc(p.title)}${p.sub?` <span style="color:#6B6560;font-weight:400">· ${esc(p.sub)}</span>`:""}</span></div>`).join("")}</div>`:""}
<div class="stlbl">Progress</div>
<div class="stgs">${stageBoxes}</div>
<div class="sig"><div><div class="sigline"></div><div class="siglbl">Completed / checked by</div></div><div><div class="sigline"></div><div class="siglbl">Collected by · date</div></div></div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),350);
}

// Compact tag/label for the physical bag or item — barcode + docket #, client, job and due date.
function printJobLabel(biz,c,job){
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups so the label can open in a new tab.");return;}
  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const ref=jobRef(job);
  const who=esc(clientDisplayName(c)||"—");
  win.document.write(`<!DOCTYPE html><html><head><title>Tag — ${ref}</title><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Poppins',sans-serif;color:#111;background:#fff;padding:14px}
.tag{width:62mm;border:1px solid #111;border-radius:6px;padding:9px 11px;text-align:center}
.tag svg{max-width:100%;height:auto}
.ref{font-size:16px;font-weight:800;letter-spacing:.06em;margin:2px 0 6px}
.who{font-size:12px;font-weight:700;line-height:1.3}
.meta{font-size:10px;color:#444;margin-top:3px;line-height:1.4}
.biz{font-size:8.5px;color:#666;margin-top:6px;text-transform:uppercase;letter-spacing:.06em}
@page{margin:6mm}
</style></head><body>
<div class="tag">
  ${barcodeSvg(ref,{h:38,mw:1.7})}
  <div class="ref">#${ref}</div>
  <div class="who">${who}</div>
  <div class="meta">${esc(job.type||"")}${job.po?` · PO ${esc(job.po)}`:""}${job.deadline?` · Due ${fmtDate(job.deadline)}`:""}</div>
  <div class="biz">${esc(biz.name||"")}</div>
</div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),300);
}

// A4 sheet of per-piece sticker labels (one per piece), laid out for Avery L7160 / J8160 (21 per
// sheet, 3 across, 63.5 x 38.1mm). Each label carries its own barcode + piece code, the client, and a
// short description so every physical piece in a batch job can be identified and scanned individually.
function printJobLabels(biz,c,job,quotes){
  const pieces=jobPieces(job,quotes);
  if(!pieces.length){alert(job?.type==="Repair"
    ?"Add repair items to the intake first — each item gets its own label."
    :"Add a quote for each piece first — each quote gets its own label.");return;}
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups so the labels can open in a new tab.");return;}
  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const trade=c?.accountType==="trade";
  const who=esc((trade&&c?.contactName)?c.contactName:(clientDisplayName(c)||"—"));
  const meta=[job.po?`PO ${esc(job.po)}`:"",job.deadline?`Due ${fmtDate(job.deadline)}`:""].filter(Boolean).join(" · ");
  const cells=pieces.map(p=>`<div class="lab">
    <div class="lb-bc">${barcodeSvg(p.code,{h:30,mw:1.6,quiet:10})}</div>
    <div class="lb-code">${esc(p.code)}</div>
    <div class="lb-who">${who}</div>
    <div class="lb-title">${esc(p.title)}</div>
    ${p.sub?`<div class="lb-sub">${esc(p.sub)}</div>`:(meta?`<div class="lb-sub">${meta}</div>`:"")}
  </div>`).join("");
  win.document.write(`<!DOCTYPE html><html><head><title>Labels — ${esc(jobRef(job))}</title><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:'Poppins',sans-serif;color:#111}
@page{size:A4;margin:0}
.sheet{width:210mm;padding:15.15mm 7.21mm 0;box-sizing:border-box}
.grid{display:grid;grid-template-columns:repeat(3,63.5mm);column-gap:2.54mm;row-gap:0}
.lab{width:63.5mm;height:38.1mm;padding:2.4mm 3mm;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-inside:avoid}
.lb-bc{width:52mm;line-height:0}
.lb-bc svg{max-width:100%;height:auto}
.lb-code{font-size:11px;font-weight:800;letter-spacing:.08em;margin-top:1mm}
.lb-who{font-size:10px;font-weight:700;margin-top:.6mm;line-height:1.15;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-title{font-size:9px;font-weight:600;color:#333;margin-top:.4mm;line-height:1.2;max-height:2.4em;overflow:hidden}
.lb-sub{font-size:8px;color:#666;margin-top:.3mm;line-height:1.15;max-height:2.3em;overflow:hidden}
</style></head><body>
<div class="sheet"><div class="grid">${cells}</div></div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),350);
}

async function printRepairIntake(biz,c,job){
  const win=window.open("","_blank");
  const photos=await jobImagesForPrint(job);
  const intake=job.intake||{};
  const items=intakeItems(intake);
  const ref=job.id.slice(-6).toUpperCase();
  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const ml=s=>esc(s).replace(/\n/g,"<br>");
  // Customer-facing price (set price, or cost already marked up) — never the raw trade cost.
  const itemAmt=it=>it.clientPrice!=null?Number(it.clientPrice):(Number(it.price)||0);
  const repairTotal=items.reduce((s,it)=>s+itemAmt(it),0);
  const hasPrices=repairTotal>0;
  const tradeIn=Number(job.repairTradeIn)||0;
  const amountDue=Math.max(0,repairTotal-tradeIn);
  const dash=`<span style="color:#bbb">—</span>`;

  // Top summary strip — the facts the customer cares about
  const sum=[
    ["Client",esc(c?.name||"—")],
    ["Taken in",job.dateIn?fmtDate(job.dateIn):"—"],
    ["Ready for collection",job.dateOut?fmtDate(job.dateOut):"—"],
    ...(hasPrices?[[`Repair total · inc ${TAX_LABEL}`,`<span style="color:#8B6914">${fmt(repairTotal)}</span>`]]:[]),
  ];
  const summaryHtml=`<div class="rsum" style="grid-template-columns:repeat(${sum.length},1fr)">${sum.map(([l,v])=>`<div><div class="rs-lbl">${l}</div><div class="rs-val">${v}</div></div>`).join("")}</div>`;

  // Items as a compact table — one row per piece
  const rows=items.length
    ?items.map((it,i)=>`<tr>
<td class="num">${i+1}</td>
<td class="ittype">${it.itemType?esc(it.itemType):dash}</td>
<td>${it.damage?ml(it.damage):dash}</td>
<td>${it.condition?ml(it.condition):dash}</td>
${hasPrices?`<td class="amt">${itemAmt(it)>0?fmt(itemAmt(it)):dash}</td>`:""}
</tr>`).join("")
    :`<tr><td colspan="${hasPrices?5:4}" style="color:#bbb;font-style:italic">No items recorded</td></tr>`;
  const itemsHtml=`<table class="itbl">
<thead><tr><th class="num">#</th><th>Item</th><th>Issue / work required</th><th>Condition on arrival</th>${hasPrices?`<th class="amt">Price</th>`:""}</tr></thead>
<tbody>${rows}</tbody></table>
${hasPrices?(tradeIn>0
  ?`<div class="rtot"><span class="rt-l">Repair total (inc ${TAX_LABEL})</span><span class="rt-v" style="font-size:15px">${fmt(repairTotal)}</span></div>
<div class="rtot" style="margin:2px 0 0"><span class="rt-l" style="color:#2D7A4F">Gold trade-in credit${tradeIn&&job.repairTradeInNote?" · "+esc(job.repairTradeInNote):""}</span><span class="rt-v" style="font-size:15px;color:#2D7A4F">− ${fmt(tradeIn)}</span></div>
<div class="rtot" style="border-top:2px solid #1A1714;margin-top:6px;padding-top:8px"><span class="rt-l">Amount due</span><span class="rt-v">${fmt(amountDue)}</span></div>`
  :`<div class="rtot"><span class="rt-l">Repair total (inc ${TAX_LABEL})</span><span class="rt-v">${fmt(repairTotal)}</span></div>`):""}`;

  // Uploaded photos of the piece(s) on intake
  const photosHtml=photos.length?`<div class="photos"><div class="ph-lbl">Photos on intake</div><div class="ph-grid">${photos.map(p=>`<figure class="ph-item"><img src="${p.url}" alt="Repair photo"/>${p.caption?`<figcaption>${esc(p.caption)}</figcaption>`:""}</figure>`).join("")}</div></div>`:"";

  win.document.write(`<!DOCTYPE html><html><head><title>Repair Receipt — ${ref}</title><style>${PCSS}
.rsum{display:grid;gap:1px;background:#E8E2D9;border:1px solid #E8E2D9;border-radius:10px;overflow:hidden;margin-bottom:26px}
.rsum>div{background:#fff;padding:12px 16px}
.rs-lbl{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
.rs-val{font-size:14px;font-weight:700;color:#1A1714}
.itbl{width:100%;border-collapse:collapse;margin-bottom:10px}
.itbl th{font-size:9px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;border-bottom:2px solid #1A1714;text-align:left}
.itbl td{padding:11px 10px;font-size:12px;border-bottom:1px solid #E8E2D9;vertical-align:top;line-height:1.5;color:#1A1714}
.itbl .num{width:26px;color:#8B6914;font-weight:800}
.itbl .ittype{font-weight:700;white-space:nowrap}
.itbl th.amt,.itbl td.amt{text-align:right;white-space:nowrap}
.itbl td.amt{font-weight:700}
.rtot{display:flex;justify-content:flex-end;align-items:baseline;gap:16px;margin:4px 0 26px}
.rtot .rt-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6B6560}
.rtot .rt-v{font-size:20px;font-weight:800}
.instr{font-size:11.5px;line-height:1.6;color:#1A1714;background:#FAF7F2;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:11px 16px;margin-bottom:26px}
.instr b{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px}
.terms{font-size:9px;line-height:1.5;color:#7A746E;margin-bottom:18px}
.terms .tt{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
.terms b{color:#1A1714}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:8px}
.sig .sigline{border-bottom:1px solid #1A1714;margin-top:30px;margin-bottom:5px}
.sig .siglbl{font-size:9px;color:#6B6560}
.photos{margin-bottom:26px}
.ph-lbl{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.ph-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ph-item{margin:0;break-inside:avoid;page-break-inside:avoid}
.ph-item img{width:100%;height:150px;object-fit:cover;border:1px solid #E8E2D9;border-radius:8px;display:block}
.ph-item figcaption{font-size:9px;color:#6B6560;margin-top:5px;line-height:1.4}
@media print{.itbl tr{page-break-inside:avoid}.ph-item{page-break-inside:avoid}}
</style></head><body>
<div class="hdr">
  <div>${biz.logo?`<img src="${biz.logo}" alt="${esc(biz.name||"Logo")}" style="max-width:180px;max-height:64px;object-fit:contain;display:block;margin-bottom:6px"/>`:`<div class="bname">${esc(biz.name||"Your Jewellery Studio")}</div>`}<div class="bsub">${[biz.email,biz.phone].filter(Boolean).map(esc).join(" · ")}</div></div>
  <div><div class="qlbl">Repair Receipt</div><div class="qnum">#${ref}</div><div style="font-size:11px;color:#6B6560;text-align:right;margin-top:3px">${fmtDate(today())}</div></div>
</div>
${summaryHtml}
${items.length>1?`<div style="font-size:10px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">${items.length} items received in this drop-off</div>`:""}
${itemsHtml}
${photosHtml}
${intake.instructions?`<div class="instr"><b>Client instructions</b>${ml(intake.instructions)}</div>`:""}
<div class="terms">
  <div class="tt">Terms &amp; conditions</div>
  <b>Gemstone &amp; diamond setting:</b> For client-supplied gemstones or diamonds we have not crafted or sourced, we cannot assume responsibility for any damage that may occur during setting or repair. The quality, integrity and condition of externally sourced stones are solely the client's responsibility; we recommend confirming their durability and suitability beforehand. By submitting such items you accept that we cannot be held liable for any damage incurred.<br><br>
  <b>Repair warranty:</b> ${esc(biz.name||"We")} carry out repairs with the utmost care and craftsmanship, but do not provide a warranty on repaired pieces. The nature of jewellery repair means we cannot guarantee against further damage, wear or failure of repaired areas after the piece leaves our care. All repairs are undertaken at the client's risk.
</div>
<div class="sig">
  <div><div class="sigline"></div><div class="siglbl">Client signature — I have read and accept the above terms</div></div>
  <div><div class="sigline"></div><div class="siglbl">Date</div></div>
</div>
<div class="footer">${esc(biz.name||"Your Jewellery Studio")}${biz.abn?" · "+TAX_ID_LABEL+" "+esc(biz.abn):""}</div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),400);
}

// Gemstone Safekeeping Receipt — proof for the client that we're holding their stone(s).
// A bailment/custody receipt: we hold as custodian, ownership stays with the client.
async function printGemCustodyReceipt(biz,c,r){
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups so the receipt can open in a new tab.");return;}
  const photos=await jobImagesForPrint(r,9);   // r.images — inlined as data URLs for reliable printing
  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const ml=s=>esc(s).replace(/\n/g,"<br>");
  const items=r.items||[];
  const ref=r.id.slice(-6).toUpperCase();
  const clientName=clientDisplayName(c)||r.clientName||"—";
  const contact=(c?[c.email,c.phone].filter(Boolean).join(" · "):"")||r.clientContact||"";
  const val=it=>Number(it.estValue)||0;
  const totalVal=items.reduce((s,it)=>s+val(it),0);
  const hasVal=totalVal>0;
  const dash=`<span style="color:#bbb">—</span>`;
  const itemLabel=it=>it&&it.kind==="piece"
    ?[esc(it.metal||""),esc(it.type||"Piece")].filter(Boolean).join(" ")||"Piece"
    :[it.carat?esc(it.carat)+"ct":"",esc(it.shape||""),esc(it.type||"Gem")].filter(Boolean).join(" ")||"Gem";
  const itemDetail=it=>it&&it.kind==="piece"
    ?[it.stones?"Set with "+esc(it.stones):"",it.measurements?esc(it.measurements):"",it.condition?"Condition: "+esc(it.condition):""].filter(Boolean).join(" · ")
    :[it.colour?"Colour "+esc(it.colour):"",it.clarity?"Clarity "+esc(it.clarity):"",it.measurements?esc(it.measurements):""].filter(Boolean).join(" · ");
  const bizName=esc(biz.name||"Our Studio");

  // Top summary strip — the facts the customer cares about
  const sum=[
    ["Held for",esc(clientName)],
    ["Received on",r.dateReceived?fmtDate(r.dateReceived):fmtDate(r.createdAt)],
    ["Expected return",r.expectedReturn?fmtDate(r.expectedReturn):"On request"],
    ...(hasVal?[["Declared value",`<span style="color:#8B6914">${fmt(totalVal)}</span>`]]:[]),
  ];
  const summaryHtml=`<div class="rsum" style="grid-template-columns:repeat(${sum.length},1fr)">${sum.map(([l,v])=>`<div><div class="rs-lbl">${l}</div><div class="rs-val">${v}</div></div>`).join("")}</div>`;

  // One row per stone
  const rows=items.length
    ?items.map((it,i)=>{
      const detail=itemDetail(it);
      return `<tr>
<td class="num">${i+1}</td>
<td class="ittype">${itemLabel(it)}${it.notes?`<div style="font-weight:400;color:#6B6560;font-size:11px;margin-top:2px">${ml(it.notes)}</div>`:""}</td>
<td>${detail||dash}</td>
<td>${it.cert?esc(it.cert):dash}</td>
${hasVal?`<td class="amt">${val(it)>0?fmt(val(it)):dash}</td>`:""}
</tr>`;}).join("")
    :`<tr><td colspan="${hasVal?5:4}" style="color:#bbb;font-style:italic">No items recorded</td></tr>`;
  const itemsHtml=`<table class="itbl">
<thead><tr><th class="num">#</th><th>Item</th><th>Details</th><th>Certificate</th>${hasVal?`<th class="amt">Declared value</th>`:""}</tr></thead>
<tbody>${rows}</tbody></table>
${hasVal?`<div class="rtot"><span class="rt-l">Total declared value</span><span class="rt-v">${fmt(totalVal)}</span></div>`:""}`;

  win.document.write(`<!DOCTYPE html><html><head><title>Safekeeping Receipt — ${ref}</title><style>${PCSS}
.rsum{display:grid;gap:1px;background:#E8E2D9;border:1px solid #E8E2D9;border-radius:10px;overflow:hidden;margin-bottom:26px}
.rsum>div{background:#fff;padding:12px 16px}
.rs-lbl{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
.rs-val{font-size:14px;font-weight:700;color:#1A1714}
.itbl{width:100%;border-collapse:collapse;margin-bottom:10px}
.itbl th{font-size:9px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;border-bottom:2px solid #1A1714;text-align:left}
.itbl td{padding:11px 10px;font-size:12px;border-bottom:1px solid #E8E2D9;vertical-align:top;line-height:1.5;color:#1A1714}
.itbl .num{width:26px;color:#8B6914;font-weight:800}
.itbl .ittype{font-weight:700}
.itbl th.amt,.itbl td.amt{text-align:right;white-space:nowrap}
.itbl td.amt{font-weight:700}
.rtot{display:flex;justify-content:flex-end;align-items:baseline;gap:16px;margin:4px 0 26px}
.rtot .rt-l{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6B6560}
.rtot .rt-v{font-size:20px;font-weight:800}
.instr{font-size:11.5px;line-height:1.6;color:#1A1714;background:#FAF7F2;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:11px 16px;margin-bottom:26px}
.instr b{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px}
.terms{font-size:9px;line-height:1.55;color:#7A746E;margin-bottom:18px}
.terms .tt{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
.terms b{color:#1A1714}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:8px}
.sig .sigline{border-bottom:1px solid #1A1714;margin-top:30px;margin-bottom:5px}
.sig .siglbl{font-size:9px;color:#6B6560}
.photos{margin-bottom:26px}
.ph-lbl{font-size:8.5px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.ph-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ph-item{margin:0;break-inside:avoid;page-break-inside:avoid}
.ph-item img{width:100%;height:150px;object-fit:cover;border:1px solid #E8E2D9;border-radius:8px;display:block}
@media print{.itbl tr{page-break-inside:avoid}.ph-item{page-break-inside:avoid}}
</style></head><body>
<div class="hdr">
  <div>${biz.logo?`<img src="${biz.logo}" alt="${bizName}" style="max-width:180px;max-height:64px;object-fit:contain;display:block;margin-bottom:6px"/>`:`<div class="bname">${bizName}</div>`}<div class="bsub">${[biz.email,biz.phone].filter(Boolean).map(esc).join(" · ")}</div></div>
  <div><div class="qlbl">Safekeeping Receipt</div><div class="qnum">#${ref}</div><div style="font-size:11px;color:#6B6560;text-align:right;margin-top:3px">${fmtDate(today())}</div></div>
</div>
<div class="to"><div class="tolbl">Held on behalf of</div><div class="toname">${esc(clientName)}</div>${contact?`<div class="todet">${esc(contact)}</div>`:""}</div>
${summaryHtml}
${items.length>1?`<div style="font-size:10px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">${items.length} items received into safekeeping</div>`:""}
${itemsHtml}
${photos.length?`<div class="photos"><div class="ph-lbl">Photos on intake</div><div class="ph-grid">${photos.map(p=>`<figure class="ph-item"><img src="${p.url}" alt="Gem photo"/></figure>`).join("")}</div></div>`:""}
${r.reason?`<div class="instr"><b>Reason held / instructions</b>${ml(r.reason)}</div>`:""}
<div class="terms">
  <div class="tt">Terms of safekeeping</div>
  <b>Acknowledgement:</b> ${bizName} confirms it has received the item(s) described above from the client named and holds them in safekeeping on the client's behalf.<br><br>
  <b>Ownership:</b> The item(s) remain the property of the client at all times. ${bizName} takes no ownership interest and holds the item(s) solely as custodian.<br><br>
  <b>Return:</b> The item(s) will be returned to the client, or handled per the client's written instructions, on presentation of this receipt and reasonable proof of identity.<br><br>
  <b>Declared value:</b> Any value shown is as declared by the client for identification purposes only and does not constitute a valuation or appraisal by ${bizName}.<br><br>
  <b>Care &amp; liability:</b> ${bizName} will take reasonable care of the item(s) while in its custody. The client is encouraged to maintain their own insurance; to the extent permitted by law, ${bizName}'s liability is limited to the declared value shown above.
</div>
<div class="sig">
  <div><div class="sigline"></div><div class="siglbl">Received into safekeeping by (${bizName})</div></div>
  <div><div class="sigline"></div><div class="siglbl">Date received</div></div>
  <div><div class="sigline"></div><div class="siglbl">Collected by client — I confirm the item(s) were returned to me in good order</div></div>
  <div><div class="sigline"></div><div class="siglbl">Date returned</div></div>
</div>
<div class="footer">${bizName}${biz.abn?" · "+TAX_ID_LABEL+" "+esc(biz.abn):""}</div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),400);
}

function printInvoiceDoc(biz,c,job,inv){console.log('Print invoice (disabled in preview)');return;
  const win=window.open("","_blank");
  const rows=inv.lineItems.map(li=>{
    const isR=lineIsRange(li);
    return `<tr><td>${li.description}</td><td class="muted">${li.detail||""}</td><td class="right">${isR?`approx ${fmt(lineCostLow(li))} – ${fmt(lineCostHigh(li))}`:fmt(lineCostLow(li))}</td></tr>`;
  }).join("");
  win.document.write(`<!DOCTYPE html><html><head><title>${inv.number}</title><style>${PCSS}</style></head><body>
<div class="hdr">
  <div><div class="bname">${biz.name||"Your Jewellery Studio"}</div><div class="bsub">${[biz.email,biz.phone].filter(Boolean).join(" · ")}</div></div>
  <div><div class="qlbl">Tax Invoice</div><div class="qnum">${inv.number}</div><div style="font-size:11px;color:#6B6560;text-align:right;margin-top:3px">${fmtDate(inv.date)}</div></div>
</div>
<div class="to"><div class="tolbl">Bill to</div><div class="toname">${c?.name||"Client"}</div><div class="todet">${[c?.email,c?.phone].filter(Boolean).join(" · ")}</div></div>
${job?.description?`<div class="desc-box"><strong>${job.type}</strong><br>${job.description}</div>`:""}
<table><thead><tr><th>Description</th><th>Detail</th><th class="right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:20px">
  <div style="min-width:240px">
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#6B6560;padding:4px 0"><span>Subtotal (ex ${TAX_LABEL})</span><span>${fmt(inv.exGST)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#6B6560;padding:4px 0"><span>${TAX_LABEL} (${+(GST_RATE*100).toFixed(2)}%)</span><span>${fmt(inv.gst)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:800;border-top:2px solid #1A1714;margin-top:6px;padding-top:8px"><span>Total inc ${TAX_LABEL}</span><span>${fmt(inv.totalIncGST)}</span></div>
  </div>
</div>
${inv.notes?`<div class="notes">${inv.notes}</div>`:""}
${biz.paymentLink?`<div style="text-align:center;margin:20px 0 6px"><a href="${biz.paymentLink}" style="display:inline-block;background:#1A1714;color:#fff;text-decoration:none;padding:11px 28px;border-radius:5px;font-size:13px;font-weight:700">Pay online</a><div style="font-size:11px;color:#6B6560;margin-top:6px">${biz.paymentLink}</div></div>`:""}
<div class="valid">Payment due within 7 days. Thank you for your business.</div>
<div class="footer">${biz.name||"Your Jewellery Studio"}${biz.abn?" · "+TAX_ID_LABEL+" "+biz.abn:""}</div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),400);
}

// ── Dashboard ─────────────────────────────────────────────────────────────
// Clickable dashboard list row — soft hover highlight that bleeds into the card padding; no trailing hairline.
function DashRow({onClick,last,children,col}){
  const[h,setH]=useState(false);
  // `col` stacks the two children vertically (used on mobile so a long job name + its amount
  // don't fight for width on one line).
  return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{display:"flex",flexDirection:col?"column":"row",alignItems:col?"flex-start":"center",justifyContent:"space-between",gap:col?3:12,padding:"10px",margin:"0 -10px",borderRadius:6,borderBottom:last?"none":`1px solid ${BD_SOFT}`,background:h&&onClick?PARCH:"transparent",cursor:onClick?"pointer":"default",transition:"background 0.12s"}}>
    {children}
  </div>;
}
// A small ⓘ help icon that reveals a plain-English explanation on hover/click. Reusable anywhere.
function InfoDot({text}){
  const[open,setOpen]=useState(false);
  return <span style={{position:"relative",display:"inline-flex",verticalAlign:"middle"}}>
    <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} aria-label="More info"
      style={{width:15,height:15,padding:0,border:"none",background:"transparent",color:WG,cursor:"pointer",lineHeight:0,display:"inline-flex",alignItems:"center",justifyContent:"center",marginLeft:6,flexShrink:0}}>
      <svg width="15" height="15" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M17.978 7.993a1.978 1.978 0 1 1-3.956 0a1.978 1.978 0 0 1 3.956 0Zm-2.118 3.975c.967 0 1.75.783 1.75 1.75v10.59a1.75 1.75 0 1 1-3.5 0v-10.59c0-.967.784-1.75 1.75-1.75Z"/><path d="M6 1a5 5 0 0 0-5 5v20a5 5 0 0 0 5 5h20a5 5 0 0 0 5-5V6a5 5 0 0 0-5-5H6ZM3 6a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Z"/></svg>
    </button>
    {open&&<span onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"160%",left:0,zIndex:60,width:300,maxWidth:"85vw",background:INK,color:WHITE,fontSize:13,fontWeight:400,lineHeight:1.6,padding:"13px 16px",borderRadius:10,boxShadow:"0 8px 28px rgba(0,0,0,0.28)",textTransform:"none",letterSpacing:0,whiteSpace:"normal"}}>{text}</span>}
  </span>;
}
// First-run getting-started checklist for a new studio. Auto-ticks steps as they're done, hides
// once all four are complete, and can be dismissed. Dismissal is stored on biz (per studio).
function GettingStarted({biz,clients,quotes,proposals,setView,onDismiss}){
  const steps=[
    {done:!!(biz?.name||"").trim(),label:"Add your business details",sub:"name, logo, tax number, payment info",go:()=>setView("settings")},
    {done:(clients||[]).length>0,label:"Add your first client",sub:"or import them later",go:()=>setView("clients")},
    {done:(quotes||[]).length>0,label:"Create a quote",sub:"open a job, then build a quote",go:()=>setView("jobs")},
    {done:(proposals||[]).length>0,label:"Send an online proposal",sub:"a link your client can accept",go:()=>setView("jobs")},
  ];
  const doneCount=steps.filter(s=>s.done).length;
  if(doneCount===steps.length)return null;
  return <Card style={{marginBottom:24,background:GOLD_L,border:`1px solid ${GOLD}55`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,gap:12}}>
      <div>
        <div style={{fontWeight:800,fontSize:16,color:INK}}>Welcome — let's get you set up 👋</div>
        <div style={{fontSize:13,color:GOLD_D,marginTop:2}}>{doneCount} of {steps.length} done. Tap a step to jump straight there.</div>
      </div>
      <button onClick={onDismiss} title="Dismiss" style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:20,padding:0,lineHeight:1,flexShrink:0}}>×</button>
    </div>
    <div style={{display:"grid",gap:8}}>
      {steps.map((s,i)=><div key={i} onClick={s.done?undefined:s.go} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 13px",background:WHITE,border:`1px solid ${BD}`,borderRadius:8,cursor:s.done?"default":"pointer",opacity:s.done?0.6:1}}>
        <span style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,background:s.done?OK:GOLD_L,color:s.done?WHITE:GOLD_D,border:s.done?"none":`1px solid ${GOLD}`}}>{s.done?"✓":i+1}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:INK,textDecoration:s.done?"line-through":"none"}}>{s.label}</div>
          <div style={{fontSize:12,color:WG,marginTop:1}}>{s.sub}</div>
        </div>
        {!s.done&&<span style={{color:GOLD_D,fontSize:16,fontWeight:700,flexShrink:0}}>→</span>}
      </div>)}
    </div>
  </Card>;
}
// ── Dashboard: revenue trend (single series → one hue), pipeline (grouped phases),
//    and a "needs attention" action panel. Built on data already in memory. ──
// Link/chain icon, shared by the "Create link" / "Copy link" buttons (inherits button text colour).
const ICON_LINK=<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M14.556 13.218a2.67 2.67 0 0 1-3.774-3.774l2.359-2.36a2.67 2.67 0 0 1 3.628-.135m-.325-3.167a2.669 2.669 0 1 1 3.774 3.774l-2.359 2.36a2.67 2.67 0 0 1-3.628.135"/><path d="M21 13c0 3.771 0 5.657-1.172 6.828S16.771 21 13 21h-2c-3.771 0-5.657 0-6.828-1.172S3 16.771 3 13v-2c0-3.771 0-5.657 1.172-6.828S7.229 3 11 3"/></svg>;
// Printer icon, shared by the Preview & Print / Print buttons (inherits button text colour).
const ICON_PRINT=<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M7.354 18c-2.123 0-3.185 0-3.94-.453a3.04 3.04 0 0 1-1.15-1.223c-.392-.77-.287-1.787-.075-3.822c.176-1.698.264-2.547.698-3.171c.285-.41.67-.745 1.121-.977C4.695 8 5.582 8 7.354 8h9.292c1.772 0 2.659 0 3.346.354c.451.232.836.567 1.121.977c.434.624.522 1.473.698 3.172c.212 2.034.317 3.052-.076 3.821a3.04 3.04 0 0 1-1.148 1.223C19.83 18 18.769 18 16.646 18M17 8V6c0-1.886 0-2.828-.586-3.414S14.886 2 13 2h-2c-1.886 0-2.828 0-3.414.586S7 4.114 7 6v2"/><path d="M13.989 16H10.01c-.685 0-1.028 0-1.32.109a1.87 1.87 0 0 0-.945.8c-.168.281-.251.642-.417 1.363c-.26 1.128-.39 1.691-.301 2.143c.117.602.484 1.112.995 1.382c.382.203.918.203 1.988.203h3.978c1.07 0 1.606 0 1.988-.203c.51-.27.878-.78.995-1.382c.089-.452-.041-1.015-.3-2.143c-.167-.72-.25-1.082-.418-1.362a1.87 1.87 0 0 0-.946-.801C15.017 16 14.674 16 13.988 16M18 12h.009"/></svg>;
// CSV-file icon, shared by the CSV export buttons (inherits button text colour).
const ICON_CSV=<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M10.294 14.016C10.248 13.024 9.571 13 8.651 13C7.235 13 7 13.338 7 14.667v1.666C7 17.662 7.235 18 8.651 18c.92 0 1.598-.024 1.643-1.016M21 13l-1.463 3.912c-.272.725-.407 1.088-.622 1.088s-.35-.363-.622-1.088L16.83 13m-2.109 0h-.972c-.389 0-.583 0-.736.063c-.522.216-.515.724-.515 1.187s-.007.97.515 1.187c.153.063.347.063.736.063c.388 0 .583 0 .736.063c.522.216.515.724.515 1.187s.007.97-.515 1.187c-.153.063-.348.063-.736.063h-1.06"/><path d="M15 22h-4.273c-3.26 0-4.892 0-6.024-.798a4.1 4.1 0 0 1-.855-.805C3 19.331 3 17.797 3 14.727v-2.545c0-2.963 0-4.445.469-5.628c.754-1.903 2.348-3.403 4.37-4.113C9.095 2 10.668 2 13.818 2c1.798 0 2.698 0 3.416.252c1.155.406 2.066 1.263 2.497 2.35C20 5.278 20 6.125 20 7.818V10"/><path d="M3 12a3.333 3.333 0 0 1 3.333-3.333c.666 0 1.451.116 2.098-.057A1.67 1.67 0 0 0 9.61 7.43c.173-.647.057-1.432.057-2.098A3.333 3.333 0 0 1 13 2"/></svg>;
// Briefcase-with-dollar icon, shared by the money tiles (This month / Outstanding).
const ICON_MONEY=<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 14c0-3.507 0-5.26.908-6.44q.25-.325.554-.592C4.57 6 6.212 6 9.5 6h5c3.288 0 4.931 0 6.038.968q.304.268.554.592C22 8.74 22 10.493 22 14s0 5.26-.908 6.44a4 4 0 0 1-.554.591C19.43 22 17.788 22 14.5 22h-5c-3.287 0-4.931 0-6.038-.968a4 4 0 0 1-.554-.592C2 19.26 2 17.507 2 14m14-8c0-1.886 0-2.828-.586-3.414S13.886 2 12 2s-2.828 0-3.414.586S8 4.114 8 6"/><path d="M12 11c-1.105 0-2 .672-2 1.5s.895 1.5 2 1.5s2 .672 2 1.5s-.895 1.5-2 1.5m0-6c.87 0 1.612.417 1.886 1M12 11v-1m0 7c-.87 0-1.612-.417-1.886-1M12 17v1m-6-6H2m20 0h-4"/></svg>;
function RevenueTrend({series}){
  const max=Math.max(1,...series.map(s=>s.value));
  return <Card style={{marginBottom:0,height:"100%",display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
      <span style={{fontWeight:700,fontSize:15,color:INK,display:"inline-flex",alignItems:"center"}}>Money received<InfoDot text="Payments and gold trade-ins you've received each month over the last 6 months — a quick read on your momentum."/></span>
      <span style={{fontSize:11,color:WG,fontWeight:600}}>last 6 months</span>
    </div>
    {/* flex:1 chart area so the bars grow to fill the card — keeps this card level with the
        Production pipeline card whether its breakdown is collapsed or expanded. */}
    <div style={{flex:1,display:"flex",alignItems:"stretch",gap:8,minHeight:120}}>
      {series.map((s,i)=>{
        const cur=i===series.length-1;
        const pct=Math.max(2,Math.round((s.value/max)*100));
        return <div key={s.mk} title={`${s.label}: ${fmt(s.value)}`} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{fontSize:10,fontWeight:700,color:cur?OK:WG,whiteSpace:"nowrap",opacity:s.value>0?1:0}}>{fmtR(s.value)}</div>
          <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{width:"100%",maxWidth:40,height:`${pct}%`,background:cur?OK:OK+"4D",borderRadius:"5px 5px 2px 2px"}}/>
          </div>
        </div>;
      })}
    </div>
    <div style={{display:"flex",gap:8,marginTop:6}}>
      {series.map(s=><div key={s.mk} style={{flex:1,textAlign:"center",fontSize:10.5,color:WG,fontWeight:600}}>{s.label}</div>)}
    </div>
  </Card>;
}
function PipelineBar({phases,totalValue,jobCount,setView,breakdown=[]}){
  const total=phases.reduce((s,p)=>s+p.count,0);
  const[showBreak,setShowBreak]=useState(false);
  const totalPaid=breakdown.reduce((s,b)=>s+(b.paid||0),0);
  return <Card style={{marginBottom:0}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
      <span style={{fontWeight:700,fontSize:15,color:INK,display:"inline-flex",alignItems:"center"}}>Production pipeline<InfoDot text="The value of active work you've got on: approved job totals, plus the average of quotes you've sent that are still live. Draft, declined and expired quotes aren't counted. Tap 'See how this is calculated' for the breakdown."/></span>
      <span style={{fontSize:11,color:WG,fontWeight:600}}>{jobCount} active</span>
    </div>
    <div style={{fontSize:22,fontWeight:800,color:INK,letterSpacing:"-0.02em",marginBottom:14}}>{fmt(totalValue)} <span style={{fontSize:12,fontWeight:600,color:WG}}>in the pipeline</span></div>
    {total===0?<div style={{fontSize:13,color:WG}}>No active jobs.</div>
     :<><div style={{display:"flex",gap:2,height:14,marginBottom:14}}>
        {phases.filter(p=>p.count>0).map(p=><div key={p.key} onClick={()=>setView("jobs")} title={`${p.key}: ${p.count}`} style={{flex:p.count,background:p.color,borderRadius:4,cursor:"pointer",minWidth:6}}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px 16px"}}>
        {phases.map(p=><div key={p.key} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
          <span style={{width:9,height:9,borderRadius:3,background:p.color,flexShrink:0}}/>
          <span style={{color:WG,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.key}</span>
          <span style={{fontWeight:800,color:INK}}>{p.count}</span>
        </div>)}
      </div>
      {breakdown.length>0&&<>
        <button onClick={()=>setShowBreak(v=>!v)} style={{marginTop:14,background:"none",border:"none",padding:0,cursor:"pointer",color:GOLD,fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{showBreak?"▾ Hide breakdown":"▸ See how this is calculated"}</button>
        {showBreak&&<div style={{marginTop:10,borderTop:`1px solid ${BD}`,paddingTop:8}}>
          {breakdown.map(b=><div key={b.id} onClick={()=>setView("jobDetail_"+b.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,padding:"7px 0",cursor:"pointer",fontSize:12}}>
            <span style={{color:INK,fontWeight:600,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.name}</span>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontWeight:700,color:INK,whiteSpace:"nowrap"}}>{fmt(b.amt)}</div>
              <div style={{fontSize:10.5,color:WG,marginTop:1,whiteSpace:"nowrap"}}>{b.detail}{b.approved&&b.paid>0?<> · <span style={{color:OK,fontWeight:700}}>{fmt(b.paid)} paid</span></>:null}</div>
            </div>
          </div>)}
          <div style={{display:"flex",justifyContent:"space-between",borderTop:`1px solid ${BD}`,marginTop:6,paddingTop:8,fontSize:13}}>
            <span style={{fontWeight:800,color:INK}}>Total</span>
            <span style={{fontWeight:800,color:INK}}>{fmt(totalValue)}</span>
          </div>
          {totalPaid>0&&<div style={{fontSize:11.5,color:WG,marginTop:6,lineHeight:1.5}}><span style={{color:OK,fontWeight:700}}>{fmt(totalPaid)}</span> already received · <span style={{color:INK,fontWeight:700}}>{fmt(Math.max(0,totalValue-totalPaid))}</span> still to come</div>}
        </div>}
      </>}
      </>}
  </Card>;
}
function NeedsAttention({items}){
  if(!items.length)return null;
  return <Card style={{marginBottom:24}}>
    <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:12,display:"flex",alignItems:"center"}}>Needs your attention<InfoDot text="Your most time-sensitive items — overdue jobs, quotes to chase (sent 7+ days, no reply), pieces ready for pickup, and balances owed. Tap any tile to jump to exactly those jobs."/></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
      {items.map(it=><div key={it.key} onClick={it.onClick} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:`1px solid ${it.color}44`,background:it.color+"12",borderRadius:10,cursor:"pointer"}}>
        <div style={{fontSize:20,lineHeight:1,flexShrink:0,color:it.color,display:"flex"}}>{it.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:800,color:it.color}}>{it.headline}</div>
          <div style={{fontSize:12,color:WG,marginTop:1}}>{it.sub}</div>
        </div>
        <span style={{color:it.color,fontSize:16,fontWeight:700,flexShrink:0}}>→</span>
      </div>)}
    </div>
  </Card>;
}
function Dashboard({clients,jobs,quotes,payments,invoices,appointments=[],proposals=[],markProposalSeen,markRepairSeen,markupTable,biz,setBiz,setView,setSelClient,openJobs,spotPrices,onUpdateSpot}){
  const go=openJobs||(()=>setView("jobs"));
  const dismissGS=()=>{if(!setBiz)return;const nb={...biz,gsDismissed:true};setBiz(nb);persist(K.biz,nb);};
  const isMobile=useIsMobile();
  const stackCols=useIsMobile(1000);   // stack the two-column bottom section on tablets too, not just phones
  // A quote the client ignored past its "valid until" date is "frozen": the public link expires AND
  // it drops out of active tracking here. Frozen = a sent proposal, no acceptance, no approved quote,
  // no money in, and every sent proposal past expiry (createdAt + the studio's quote-validity window).
  const validityDays=biz?.quoteValidityDays||30;
  const propExpired=p=>p?.createdAt?addDays(String(p.createdAt).slice(0,10),validityDays)<today():false;
  const isFrozen=j=>{
    const jp=proposals.filter(p=>p.jobId===j.id);
    const sent=jp.filter(p=>p.status==="sent");
    if(!sent.length||jp.some(p=>p.status==="accepted"))return false;
    if(quotes.some(q=>q.jobId===j.id&&q.status==="Approved"))return false;
    const cash=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
    if(cash>0||jobTradeInCredit(j,quotes)>0)return false;
    return sent.every(propExpired);
  };
  // Proposals a client accepted that haven't been acknowledged yet → dashboard alert
  const acceptedUnseen=proposals.filter(p=>p.status==="accepted"&&p.seen===false);
  // Repair links a client accepted/declined that haven't been acknowledged yet
  const repairUnseen=jobs.filter(j=>j.repairResponse&&j.repairResponse.seen===false);
  const active=jobs.filter(j=>j.stage!=="Collected"&&!j.parked&&!isFrozen(j));   // parked/frozen → dropped from active tracking
  const frozenCount=jobs.filter(j=>j.stage!=="Collected"&&!j.parked&&isFrozen(j)).length;   // expired, ignored quotes
  // Rank active jobs by momentum so the ones that matter (money in, a proposal out awaiting a reply,
  // approved/in production, overdue) surface first — a stale sent-quote with no engagement sinks and
  // is dimmed. Each row also carries the signals we show (paid, owing, proposal status).
  const PROD_STAGES=["Item ordered","On the bench","Design / CAD","3D printing","Manufacturing","Stone setting","Polishing / Finish","QC check"];
  const daysAgo=d=>{const n=Math.round((Date.now()-parseISO(d).getTime())/86400000);return n<=0?"today":n===1?"1 day ago":`${n} days ago`;};
  const activeRanked=active.map(j=>{
    const cash=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
    const tradeIn=jobTradeInCredit(j,quotes);            // gold trade-in credit — also value received
    const received=cash+tradeIn;                         // "money in" = cash + trade-in
    const jp=proposals.filter(p=>p.jobId===j.id);
    const propAccepted=jp.some(p=>p.status==="accepted");
    const sentProp=jp.filter(p=>p.status==="sent").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0];
    const propSent=!!sentProp;
    const approved=quotes.some(q=>q.jobId===j.id&&q.status==="Approved");
    const od=!jobIsDone(j)&&j.deadline&&j.deadline<today();
    const ready=j.stage==="Ready for collection";
    const inProd=PROD_STAGES.includes(j.stage);
    const total=jobHasCharge(j,quotes)?jobChargeTotal(j,quotes,markupTable,invoices):0;
    const owing=Math.max(0,total-received);
    const awaiting=propSent&&!propAccepted&&!approved;   // proposal out, no yes yet
    const awaitDays=awaiting&&sentProp?.createdAt?Math.round((Date.now()-parseISO(sentProp.createdAt).getTime())/86400000):null;
    const stale=awaiting&&awaitDays!=null&&awaitDays>21;   // sent 3+ weeks ago, still no reply → effectively dead
    let score=0;
    if(received>0)score+=100;
    if(propAccepted||approved)score+=60;
    if(ready)score+=55;
    if(awaiting)score+=stale?8:45;                        // a fresh proposal matters; a stale one sinks
    if(inProd)score+=35;
    if(od)score+=30;
    const quiet=!(received>0||propAccepted||approved||propSent||ready||inProd||od);
    return {j,received,tradeIn,owing,awaiting,propAccepted,approved,od,ready,inProd,sentProp,quiet,stale,score};
  }).sort((a,b)=>b.score-a.score
    ||String(a.j.deadline||"9999-99-99").localeCompare(String(b.j.deadline||"9999-99-99"))
    ||String(b.j.createdAt||"").localeCompare(String(a.j.createdAt||"")));
  const tISO=localToday();
  const upcomingAppts=[...appointments].filter(a=>(!a.status||a.status==="Scheduled")&&a.date>=tISO).sort((a,b)=>String(a.date+(a.time||"")).localeCompare(String(b.date+(b.time||"")))).slice(0,6);
  const todaysAppts=appointments.filter(a=>a.date===tISO&&(!a.status||a.status==="Scheduled"));
  const ready=jobs.filter(j=>j.stage==="Ready for collection");
  // Overdue = past deadline AND not finished/awaiting pickup — consistent with the Jobs list flag
  // (a "Ready for collection" job is done, so it's never counted as overdue).
  const overdue=active.filter(j=>!jobIsDone(j)&&j.deadline&&j.deadline<today());
  const thisMonth=new Date().toISOString().slice(0,7);
  // Cash-received view: actual payments received this month (deposits included), regardless of invoicing
  // Value received this month = cash payments dated this month + gold trade-in credits on approved
  // quotes whose most recent activity was this month (trade-ins have no date of their own).
  const monthReceived=payments.filter(p=>p.status==="Received"&&p.date?.startsWith(thisMonth)).reduce((s,p)=>s+Number(p.amount),0)
    +quotes.filter(q=>q.status==="Approved"&&(Number(q.tradeInCredit)||0)>0&&String(q.updatedAt||q.createdAt||"").slice(0,7)===thisMonth).reduce((s,q)=>s+Number(q.tradeInCredit),0);
  const balanceOwing=jobs.map(j=>{
    if(!jobHasCharge(j,quotes))return null;
    const total=jobChargeTotal(j,quotes,markupTable,invoices);
    const paid=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
    const bal=total-paid-jobTradeInCredit(j,quotes);   // trade-in is a credit received
    return bal>1?{job:j,balance:bal}:null;
  }).filter(Boolean);
  // Outstanding = total still owed across approved jobs (quote total − payments received)
  const outstanding=balanceOwing.reduce((s,b)=>s+b.balance,0);

  // ── Revenue trend (6 months) + month-over-month comparison ──
  const receivedForMonth=mk=>payments.filter(p=>p.status==="Received"&&p.date?.startsWith(mk)).reduce((s,p)=>s+Number(p.amount),0)
    +quotes.filter(q=>q.status==="Approved"&&(Number(q.tradeInCredit)||0)>0&&String(q.updatedAt||q.createdAt||"").slice(0,7)===mk).reduce((s,q)=>s+Number(q.tradeInCredit),0);
  const revSeries=[...Array(6)].map((_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i));const mk=d.toISOString().slice(0,7);return {mk,label:new Date(mk+"-01").toLocaleDateString(LOCALE,{month:"short"}),value:receivedForMonth(mk)};});
  const lastMonthReceived=revSeries.length>1?revSeries[revSeries.length-2].value:0;
  const monthTrend=lastMonthReceived>0?{pct:Math.round(((monthReceived-lastMonthReceived)/lastMonthReceived)*100),up:monthReceived>=lastMonthReceived}:null;
  // ── Production pipeline — active jobs grouped into a few phases (not 12 colours) + total value ──
  const pipePhases=[
    {key:"Quoting",       stages:["Enquiry","Consultation","Quoted"], color:"#A0845C"},
    {key:"Approved",      stages:["Approved"],                        color:"#4E8B6A"},
    {key:"In production", stages:PROD_STAGES,                         color:"#3E8E8E"},
    {key:"Ready",         stages:["Ready for collection","In transit to customer"], color:"#2D7A4F"},
  ].map(p=>({...p,count:active.filter(j=>p.stages.includes(j.stage)).length}));
  // Potential pipeline value: the approved total where a price is confirmed, else the AVERAGE of the
  // job's quotes — sending a client 3 material options for one piece counts once as a middle estimate
  // (not the priciest), so multi-option jobs don't inflate the figure.
  const jobPipelineValue=j=>{
    if(jobHasCharge(j,quotes))return jobChargeTotal(j,quotes,markupTable,invoices);
    // Only quotes actually sent to the client and still live count — drop drafts, declined, and any past their valid-until date.
    const qs=quotes.filter(q=>q.jobId===j.id&&q.status==="Sent"&&(!q.validUntil||String(q.validUntil)>=today()));
    return qs.length?qs.reduce((s,q)=>s+quoteGrandTotal(q,markupTable),0)/qs.length:0;
  };
  const pipelineValue=active.reduce((s,j)=>s+jobPipelineValue(j),0);
  // Line-by-line breakdown so the pipeline total is auditable.
  const pipelineBreakdown=active.map(j=>{
    const amt=jobPipelineValue(j);
    const c=clients.find(x=>x.id===j.clientId);
    const sentQs=quotes.filter(q=>q.jobId===j.id&&q.status==="Sent"&&(!q.validUntil||String(q.validUntil)>=today()));
    const approved=jobHasCharge(j,quotes);
    const paid=approved?payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0)+jobTradeInCredit(j,quotes):0;
    const detail=approved?"approved total":sentQs.length>1?`avg of ${sentQs.length} sent quotes`:sentQs.length===1?"1 sent quote":"—";
    return {id:j.id,name:`${j.type} · ${clientDisplayName(c)}`,amt,detail,approved,paid};
  }).filter(x=>x.amt>0).sort((a,b)=>b.amt-a.amt);
  // ── "Needs your attention" — the actionable items, only when non-zero ──
  const chaseCount=activeRanked.filter(r=>r.awaiting&&r.sentProp?.createdAt&&Math.round((Date.now()-parseISO(r.sentProp.createdAt).getTime())/86400000)>=7).length;
  const attention=[
    overdue.length&&{key:"overdue",icon:"⏰",color:DANGER,headline:`${overdue.length} overdue`,sub:"past their due date",onClick:()=>go("overdue")},
    chaseCount>0&&{key:"chase",icon:"📨",color:GOLD_D,headline:`${chaseCount} quote${chaseCount>1?"s":""} to chase`,sub:"sent 7+ days ago, no reply",onClick:()=>go("chase")},
    ready.length&&{key:"ready",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={OK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3.338A9.95 9.95 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10q-.002-1.03-.2-2"/><path d="M8 12.5s1.5 0 3.5 3.5c0 0 5.559-9.167 10.5-11"/></svg>,color:OK,headline:`${ready.length} ready to collect`,sub:"waiting on pickup",onClick:()=>go("ready")},
    balanceOwing.length&&{key:"owing",icon:ICON_MONEY,color:WARN,headline:`${fmt(outstanding)} owing`,sub:`across ${balanceOwing.length} job${balanceOwing.length>1?"s":""}`,onClick:()=>go("owing")},
  ].filter(Boolean);
  const trendChip=monthTrend?<span style={{fontSize:11,fontWeight:800,color:monthTrend.up?OK:DANGER,whiteSpace:"nowrap"}}>{monthTrend.up?"▲":"▼"} {Math.abs(monthTrend.pct)}%</span>:null;

  return <div>
    {/* Accepted-proposal alerts */}
    {acceptedUnseen.map(p=>{
      const job=jobs.find(j=>j.id===p.jobId);
      const cl=job?clients.find(x=>x.id===job.clientId):null;
      const labels=String(p.acceptedQuoteId||"").split(",").map(s=>s.trim()).filter(Boolean).map(id=>{const aq=quotes.find(x=>x.id===id);return aq?quoteLabel(aq):"";}).filter(Boolean).join(" + ");
      return <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,background:OK+"10",border:`1px solid ${OK}55`,borderRadius:5,padding:"14px 18px",marginBottom:14}}>
        <div style={{fontSize:24,lineHeight:1}}>🎉</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:800,color:INK}}>Proposal accepted{cl?.name?` — ${cl.name}`:""}</div>
          <div style={{fontSize:13,color:WG,marginTop:2}}><strong style={{color:OK}}>{p.acceptedName||"Client"}</strong> accepted “{labels||"an option"}”{job?` for ${job.type}`:""}{p.acceptedAt?` on ${fmtDate(p.acceptedAt)}`:""} — quote{labels.includes(" + ")?"s":""} approved.</div>
        </div>
        <Btn sm onClick={()=>{markProposalSeen&&markProposalSeen(p.id);if(job)setView("jobDetail_"+job.id);}}>Review</Btn>
        <button onClick={()=>markProposalSeen&&markProposalSeen(p.id)} title="Dismiss" style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:18,padding:0,lineHeight:1}}>×</button>
      </div>;
    })}
    {/* Repair accept/decline alerts */}
    {repairUnseen.map(job=>{
      const cl=clients.find(x=>x.id===job.clientId);
      const r=job.repairResponse;const acc=r.decision!=="declined";
      return <div key={job.id} style={{display:"flex",alignItems:"center",gap:14,background:(acc?OK:DANGER)+"10",border:`1px solid ${(acc?OK:DANGER)}55`,borderRadius:5,padding:"14px 18px",marginBottom:14}}>
        <div style={{fontSize:24,lineHeight:1}}>{acc?"🎉":"⚠️"}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:800,color:INK}}>Repair {acc?"accepted":"declined"}{cl?.name?` — ${cl.name}`:""}</div>
          <div style={{fontSize:13,color:WG,marginTop:2}}><strong style={{color:acc?OK:DANGER}}>{r.name||"Client"}</strong> {acc?"accepted":"declined"} the {job.type||"repair"} online{r.at?` on ${fmtDate(r.at)}`:""}.</div>
        </div>
        <Btn sm onClick={()=>{markRepairSeen&&markRepairSeen(job.id);setView("jobDetail_"+job.id);}}>Review</Btn>
        <button onClick={()=>markRepairSeen&&markRepairSeen(job.id)} title="Dismiss" style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:18,padding:0,lineHeight:1}}>×</button>
      </div>;
    })}
    <div style={{marginBottom:28}}>
      <div style={{fontSize:11,fontWeight:700,color:WG,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>Workshop overview</div>
      <h1 style={{margin:0,fontSize:32,fontWeight:700,color:INK,letterSpacing:"-0.02em",fontFamily:"'Poppins',sans-serif"}}>{(()=>{const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";})()}</h1>
      <div style={{color:INK,fontSize:15,marginTop:6,lineHeight:1.5}}>{[todaysAppts.length>0&&`${todaysAppts.length} appointment${todaysAppts.length>1?"s":""} today`,`${active.length} active job${active.length!==1?"s":""}`,overdue.length>0&&`${overdue.length} overdue`,ready.length>0&&`${ready.length} ready to collect`].filter(Boolean).join(" · ")||"Here's everything happening in your workshop today."}</div>
      <div style={{color:WG,fontSize:12.5,marginTop:3}}>{fmtDate(today())}</div>
    </div>
    {onUpdateSpot&&<button onClick={onUpdateSpot} title="Set today's gold, platinum and silver spot prices, and every quote recalculates automatically" style={{display:"inline-flex",alignItems:"center",gap:9,background:WHITE,border:`1px solid ${BD}`,borderRadius:10,padding:"9px 15px",fontSize:12.5,fontWeight:700,color:INK,cursor:"pointer",fontFamily:"inherit",marginBottom:24,boxShadow:SHADOW}}>
      <span style={{color:GOLD_D,fontSize:14,lineHeight:1}}>⟳</span>Update metal spot prices{spotPrices?.updatedAt&&<span style={{fontWeight:400,color:WG}}> · last updated {fmtDate(spotPrices.updatedAt)}</span>}
    </button>}
    {!biz?.gsDismissed&&<GettingStarted biz={biz} clients={clients} quotes={quotes} proposals={proposals} setView={setView} onDismiss={dismissGS}/>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(176px,1fr))",gap:14,marginBottom:24}}>
      <Stat label="Today's appts" value={todaysAppts.length} sub={todaysAppts.length>0?fmtTime(todaysAppts.slice().sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")))[0].time)+" first":"none today"} tint="slate" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 2v4M8 2v4m13 7v-1c0-3.771 0-5.657-1.172-6.828S16.771 4 13 4h-2C7.229 4 5.343 4 4.172 5.172S3 8.229 3 12v2c0 3.771 0 5.657 1.172 6.828S7.229 22 11 22M3 10h18"/><path d="M13 19.5s1.348.507 2 2.5c0 0 3.177-5 6-6"/></svg>} onClick={()=>setView("appointments")}/>
      <Stat label="Clients" value={clients.length} tint="slate" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="m14.5 16.5l3.716 1.118a4.07 4.07 0 0 1 2.76 2.892c.136.536-.327.99-.882.99H3.906c-.555 0-1.018-.454-.882-.99a4.07 4.07 0 0 1 2.76-2.892L9.5 16.5v-1.938c-1.78-1.393-3-3.062-3-6.645c0-3.59 1.955-5.417 4.992-5.417c2.151 0 3.047 1 3.047 1c2.538 0 2.961 2.097 2.961 4.417c0 3.583-1.22 5.252-3 6.645z"/></svg>} onClick={()=>setView("clients")}/>
      <Stat label="Active jobs" value={active.length} tint="slate" icon={<svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor"><g fill="currentColor" fillRule="evenodd" clipRule="evenodd"><path d="m12.437 10.293l.06-.859a1.69 1.69 0 0 0-.999-1.628a9 9 0 0 0-2.497-.41a7.5 7.5 0 0 0-1.839 0c-.475.065-.92.27-1.278.59a1.77 1.77 0 0 0-.48.829a6 6 0 0 0-.11 1.578c-.999 0-2.058.09-3.087.09a.29.29 0 1 0 0 .58c2.128.15 4.266.25 6.414.28h6.364c1.059 0 1.838.11 2.757.209c.148.638.195 1.295.14 1.948a2.9 2.9 0 0 1-.69 1.998a3.2 3.2 0 0 1-1.098.21l-1.679.17l-3.216.26v-.35a1.77 1.77 0 0 0-1.21-1.399a1.6 1.6 0 0 0-1.738.54a2.4 2.4 0 0 0-.49 1.159v.11c-.739-.06-2.307-.14-3.716-.31q-.746-.072-1.478-.23a1.8 1.8 0 0 1-.72-.26c-.436-.34-.72-.84-.789-1.388a12.7 12.7 0 0 1 .05-2.778a.29.29 0 1 0-.57-.07A12.8 12.8 0 0 0 .15 14.11c.009.775.316 1.516.86 2.068c.65.41 1.399.637 2.167.66q2.228.123 4.456 0q.02.457.09.909a.3.3 0 0 0 .32.26a.29.29 0 0 0 .25-.31a6 6 0 0 1 .06-1.249c.048-.35.213-.674.469-.919a.66.66 0 0 1 .73-.15a.7.7 0 0 1 .459.57c0 .17.05.35.07.54q.045.414 0 .828a1.9 1.9 0 0 1-.28.78c-.132.167-.3.303-.49.4a.57.57 0 0 1-.48.09a.4.4 0 0 1-.12-.11a3 3 0 0 1-.149-.27a.33.33 0 0 0-.42-.2a.32.32 0 0 0-.16.43q.073.231.2.439q.12.18.3.3a1.2 1.2 0 0 0 1 .09a2.3 2.3 0 0 0 1.068-.64c.282-.329.475-.724.56-1.149q.083-.364.09-.739c1.049 0 2.837.12 4.275 0a5.3 5.3 0 0 0 2.398-.52c.545-.61.847-1.4.85-2.217c.269-3.717-.57-3.427-6.285-3.707m-4.515 0l-2.058.08q.045-.558.19-1.099c.056-.23.186-.438.37-.59c.251-.155.542-.238.838-.239a8.5 8.5 0 0 1 1.609.08h.999c.424-.025.849.019 1.259.13a.94.94 0 0 1 .659.839v.76a71 71 0 0 0-3.866-.01z"/><path d="M17.053 17.007a.32.32 0 0 0-.33.31l-.2 3.656c.015.345-.015.691-.09 1.029a.8.8 0 0 1-.24.44c-.295.206-.64.333-.998.37a12 12 0 0 1-1.859.139H10.92c-1.908-.07-3.827-.2-5.745-.21q-1.123.069-2.248 0a1.9 1.9 0 0 1-1.148-.42a.7.7 0 0 1-.19-.419a5 5 0 0 1 0-.999v-3.756a.298.298 0 1 0-.58-.14l-.17 3.826q-.075.583-.04 1.169c.027.333.16.648.38.9c.335.338.762.571 1.229.668c.92.162 1.854.229 2.787.2c1.898 0 3.807.19 5.715.23h2.497c.671-.022 1.34-.1 1.998-.23a3.06 3.06 0 0 0 1.37-.63c.252-.243.42-.562.479-.908q.1-.62.07-1.25v-3.626a.32.32 0 0 0-.27-.35m6.503-11.838c-.28-.64-.72-1.289-1-1.808c-.18-.35-.35-.83-.579-1.219a2.4 2.4 0 0 0-.47-.59a2.7 2.7 0 0 0-1.098-.479c-.76-.17-1.729-.21-2.198-.31c-.77-.16-1.519-.4-2.288-.56a8 8 0 0 0-1.079-.179a5 5 0 0 0-.94 0c-.202.02-.396.097-.559.22a1 1 0 0 0-.35.61c-.12.499-.13 1.318-.2 1.588q-.221.766-.559 1.488c-.36.74-.779 1.449-1.198 2.138a.28.28 0 0 0 .08.39a.29.29 0 0 0 .4-.08c.459-.69.928-1.399 1.328-2.148q.405-.756.68-1.568l.359-1.719h.87q.475.052.938.18c.77.19 1.519.45 2.278.64c.41.09 1.199.14 1.898.27q.295.048.58.139c-.09.21-.18.42-.28.62c-.18.38-.37.739-.58 1.098s-.32.52-.45.78a2 2 0 0 0-.219.789a1.22 1.22 0 0 0 .94 1.229l.589.13h1.078l1.28-.18c0 .08 0 .17-.07.26c-.15.449-.37.929-.47 1.248a34 34 0 0 1-1.379 3.867a18 18 0 0 1-1.269 2.357a.323.323 0 0 0 .207.498a.32.32 0 0 0 .333-.138q.8-1.146 1.399-2.408a34 34 0 0 0 1.578-3.836c.13-.37.43-.94.59-1.449c.098-.275.139-.567.12-.859a3.4 3.4 0 0 0-.29-1.009m-2.058.85l-.89-.1l-.35-.13c-.16-.07-.249-.12-.249-.22c.02-.193.077-.38.17-.55c.11-.23.22-.48.31-.709c.09-.23.23-.65.33-1c.1-.349.13-.459.189-.688c0 .05.07.1.1.16c.18.36.34.759.5.998c.16.24.609 1 .889 1.479q.156.29.27.6zm-15.086.998a.28.28 0 0 0 .19.36a.27.27 0 0 0 .4-.21a10.6 10.6 0 0 0 .589-2.088q.144-1.064.18-2.138c0-.15-.16-.64-.18-.939q1.663.082 3.307.34a.33.33 0 0 0 .39-.25a.33.33 0 0 0-.29-.38A30 30 0 0 0 7.562.962a.94.94 0 0 0-.86.32a1.2 1.2 0 0 0-.12.5c0 .369.06.919 0 1.138q.086 1.234 0 2.468q-.023.82-.169 1.628"/><path d="M15.814 4.429q.396.172.81.3c.419.14.838.23 1.238.38a.33.33 0 0 0 .44-.09a.32.32 0 0 0-.13-.44a8.6 8.6 0 0 0-1.11-.74a4 4 0 0 0-.509-.25a9 9 0 0 0-.54-.18c-.439-.11-.868-.149-1.298-.219a.29.29 0 0 0-.19.54c.47.2.83.48 1.289.699m-2.338 1.389a.3.3 0 0 0 .24.32q.73.245 1.429.569q.49.196.999.34c.56.18 1.129.299 1.718.429a.31.31 0 0 0 .41-.19a.32.32 0 0 0-.19-.42c-.49-.24-.93-.509-1.399-.739a6 6 0 0 0-.999-.38a7.4 7.4 0 0 0-1.838-.18a.28.28 0 0 0-.37.25"/></g></svg>} onClick={()=>setView("jobs")}/>
      <Stat label="This month" value={fmt(monthReceived)} sub={monthTrend?`vs ${fmt(lastMonthReceived)} last month`:"received (incl. trade-ins)"} tint="mint" icon={ICON_MONEY} trend={trendChip}/>
      <Stat label="Outstanding" value={fmt(outstanding)} sub="balance owed" tint={outstanding>0?"peach":"mint"} icon={ICON_MONEY}/>
      <Stat label="Ready to collect" value={ready.length} tint="slate" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 20s1 0 2 2c0 0 3.177-5 6-6M7 16h4m-4-5h8M6.5 3.5c-1.556.047-2.483.22-3.125.862c-.879.88-.879 2.295-.879 5.126v6.506c0 2.832 0 4.247.879 5.127C4.253 22 5.668 22 8.496 22h2.5m4.496-18.5c1.556.047 2.484.22 3.125.862c.88.88.88 2.295.88 5.126V13.5"/><path d="M6.496 3.75c0-.966.784-1.75 1.75-1.75h5.5a1.75 1.75 0 1 1 0 3.5h-5.5a1.75 1.75 0 0 1-1.75-1.75"/></svg>} onClick={()=>go("ready")}/>
      <Stat label="Overdue" value={overdue.length} tint={overdue.length>0?"rose":"mint"} icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4v12a2 2 0 0 0 2 2h9.5a.5.5 0 0 0 0-1H6a1 1 0 0 1-1-1h10a1 1 0 0 0 1-1V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Zm10-1a1 1 0 0 1 1 1v11H5V4a1 1 0 0 1 1-1h8Zm-4 2a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 10 5Zm0 8a.75.75 0 1 0 0-1.5a.75.75 0 0 0 0 1.5Z"/></svg>} onClick={()=>go("overdue")}/>
    </div>
    <NeedsAttention items={attention}/>
    <div style={{display:"grid",gridTemplateColumns:stackCols?"1fr":"1fr 1fr",gap:16,marginBottom:24,alignItems:"stretch"}}>
      <RevenueTrend series={revSeries}/>
      <PipelineBar phases={pipePhases} totalValue={pipelineValue} jobCount={active.length} setView={setView} breakdown={pipelineBreakdown}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:stackCols?"1fr":"minmax(0,1.6fr) minmax(0,1fr)",gap:16,alignItems:"start"}}>
      <Card style={{marginBottom:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontWeight:700,fontSize:15,color:INK,display:"inline-flex",alignItems:"center"}}>Active jobs<InfoDot text="Your live jobs, ranked by momentum — money in, approved or in production first; a fresh proposal awaiting a reply next. Quotes ignored past their expiry drop off automatically."/></span>
          <Btn sm ghost onClick={()=>setView("jobs")}>View all</Btn>
        </div>
        {active.length===0&&<div style={{color:WG,fontSize:14}}>No active jobs.</div>}
        {activeRanked.slice(0,8).map(({j,received,tradeIn,owing,awaiting,ready,sentProp,quiet,stale,od},i,arr)=>{
          const c=clients.find(x=>x.id===j.clientId);
          // Sub-line = the signal that isn't already shown by the money chip / stage badge.
          const signal=ready?{t:"Ready to collect",col:OK}
            :awaiting?{t:`⏳ Proposal sent${sentProp?.createdAt?` · ${daysAgo(sentProp.createdAt)}`:""}`,col:stale?WG:GOLD_D}
            :quiet?{t:"Quote out — no reply yet",col:WG}
            :null;
          return <DashRow key={j.id} onClick={()=>setView("jobDetail_"+j.id)} last={i===arr.length-1} col={isMobile}>
            <div style={{minWidth:0,opacity:(quiet||stale)?0.58:1}}>
              <div style={{fontWeight:600,fontSize:13,color:INK}}>{j.type} <span style={{color:WG,fontWeight:400}}>· {clientDisplayName(c)}</span></div>
              <div style={{fontSize:12,marginTop:2}}>
                {signal&&<span style={{color:signal.col,fontWeight:signal.col===WG?400:700}}>{signal.t}</span>}
                {signal&&j.deadline&&<span style={{color:WG}}> · </span>}
                {j.deadline&&<span style={{color:od?DANGER:WG,fontWeight:od?700:400}}>Due {fmtDate(j.deadline)}{od?" — overdue":""}</span>}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:isMobile?"flex-start":"flex-end",gap:3,flexShrink:0}}>
              {received>0&&<span style={{fontSize:12.5,fontWeight:800,color:OK,whiteSpace:"nowrap"}}>{fmt(received)} in{tradeIn>0?<span style={{fontSize:10.5,fontWeight:600,color:WG}}> · incl. trade-in</span>:null}</span>}
              {owing>0&&<span style={{fontSize:12,fontWeight:700,color:WARN,whiteSpace:"nowrap"}}>{fmt(owing)} owing</span>}
              <Badge label={j.stage} color={SC[j.stage]||WG}/>
            </div>
          </DashRow>;
        })}
        {frozenCount>0&&<div onClick={()=>go("frozen")} style={{marginTop:12,fontSize:12,color:WG,cursor:"pointer"}}>❄ {frozenCount} expired quote{frozenCount>1?"s":""} hidden — <span style={{color:GOLD,fontWeight:700}}>view in Jobs</span></div>}
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <Card style={{marginBottom:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontWeight:700,fontSize:15,color:INK}}>Upcoming appointments</span>
            <Btn sm ghost onClick={()=>setView("appointments")}>View all</Btn>
          </div>
          {upcomingAppts.length===0&&<div style={{color:WG,fontSize:14}}>None scheduled.</div>}
          {upcomingAppts.map((a,i,arr)=>{
            const col=APPT_COLORS[a.type]||GOLD;const c=a.clientId&&clients.find(x=>x.id===a.clientId);
            return <DashRow key={a.id} onClick={c?()=>{setSelClient&&setSelClient(a.clientId);setView("clientDetail");}:()=>setView("appointments")} last={i===arr.length-1}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{apptName(a,clients)} <span style={{color:WG,fontWeight:400}}>· {a.type}</span></div>
                <div style={{fontSize:12,color:a.date===tISO?GOLD:WG,marginTop:1}}>{a.date===tISO?"Today":fmtDayShort(a.date)}{a.time?` · ${fmtTime(a.time)}`:""}</div>
              </div>
              <span style={{width:8,height:8,borderRadius:"50%",background:col,flexShrink:0,marginLeft:10}}/>
            </DashRow>;
          })}
        </Card>
        {balanceOwing.length>0&&<Card style={{marginBottom:0}}>
          <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Balance owing by job</div>
          {balanceOwing.map(({job,balance},i,arr)=>{
            const c=clients.find(x=>x.id===job.clientId);
            return <DashRow key={job.id} onClick={()=>setView("jobDetail_"+job.id)} last={i===arr.length-1} col={isMobile}>
              <div style={{minWidth:0}}><div style={{fontWeight:600,fontSize:13,color:INK}}>{job.type} · {clientDisplayName(c)}</div><div style={{fontSize:12,color:WG}}>{job.stage}</div></div>
              <div style={{fontWeight:800,fontSize:15,color:WARN,whiteSpace:"nowrap",flexShrink:0}}>{fmt(balance)} <span style={{fontSize:11,fontWeight:600,opacity:0.75}}>owing</span></div>
            </DashRow>;
          })}
        </Card>}
        <Card style={{marginBottom:0}}>
          <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Anniversary reminders</div>
          {clients.filter(c=>c.anniversary).length===0?<div style={{color:WG,fontSize:14}}>None recorded.</div>
          :clients.filter(c=>c.anniversary).sort((a,b)=>a.anniversary.slice(5).localeCompare(b.anniversary.slice(5))).map((c,i,arr)=>(
            <DashRow key={c.id} onClick={()=>{setSelClient&&setSelClient(c.id);setView("clientDetail");}} last={i===arr.length-1}>
              <span style={{fontWeight:600,color:INK,fontSize:13}}>{c.name}</span><span style={{color:WG,fontSize:13}}>{fmtDate(c.anniversary)}</span>
            </DashRow>
          ))}
        </Card>
      </div>
    </div>
  </div>;
}

// ── Clients ───────────────────────────────────────────────────────────────
function ClientForm({initial={},onSave,onCancel}){
  const[f,setF]=useState({name:"",email:"",phone:"",partnerName:"",partnerEmail:"",partnerPhone:"",street:"",city:"",state:"",postcode:"",notes:"",accountType:"retail",contactName:"",abn:"",terms:"",creditLimit:"",poRequired:false,...initial});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const trade=f.accountType==="trade";
  return <div>
    {/* Account type — retail (public) vs trade (wholesale / other jewellers) */}
    <div style={{marginBottom:16}}>
      <label style={SS.lbl}>Account type</label>
      <div style={{display:"flex",gap:8,marginTop:6}}>
        {[["retail","Retail — individual","A member of the public"],["trade","Trade — business","Wholesale · other jewellers"]].map(([v,t,sub])=>(
          <button key={v} type="button" onClick={()=>set("accountType")(v)} style={{flex:1,textAlign:"left",cursor:"pointer",fontFamily:"inherit",border:`1.5px solid ${f.accountType===v?GOLD:BD}`,background:f.accountType===v?GOLD_L:WHITE,borderRadius:8,padding:"10px 14px",transition:"all .15s"}}>
            <div style={{fontSize:13,fontWeight:700,color:f.accountType===v?GOLD_D:INK}}>{t}</div>
            <div style={{fontSize:11,color:WG,marginTop:2}}>{sub}</div>
          </button>
        ))}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label={trade?"Business / trading name":"Full name"} value={f.name} onChange={set("name")} placeholder={trade?"Precious Metals Co":"Sarah Mitchell"}/>
      <Input label="Phone" value={f.phone} onChange={set("phone")} placeholder="0412 345 678"/>
      <Input label="Email" value={f.email} onChange={set("email")} placeholder={trade?"accounts@business.com.au":"sarah@example.com"}/>
      {trade&&<Input label="Main contact person" value={f.contactName||""} onChange={set("contactName")} placeholder="e.g. workshop manager"/>}
    </div>
    {trade?<>
      <div style={{borderTop:`1px solid ${BD}`,margin:"6px 0 14px"}}/>
      <div style={{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Trade account</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Input label={TAX_ID_LABEL} value={f.abn||""} onChange={set("abn")} placeholder="12 345 678 901"/>
        <Input label="Account terms" value={f.terms||""} onChange={set("terms")} as="select" options={[{value:"",label:"— Select —"},"COD","Net 7","Net 14","Net 30","EOM (end of month)"]}/>
        <Input label={`Credit limit (${CUR_SYM}) — optional`} value={f.creditLimit||""} onChange={set("creditLimit")} type="number" min="0" step="1" placeholder="e.g. 5000"/>
      </div>
      <div style={{fontSize:11,color:WG,margin:"-4px 0 14px",lineHeight:1.5}}>Trade pricing comes from your <strong>Trade markups</strong> in Settings — quotes for this account use them automatically.</div>
      <label style={{display:"flex",alignItems:"center",gap:9,fontSize:13,color:INK,cursor:"pointer",margin:"2px 0 16px"}}>
        <input type="checkbox" checked={!!f.poRequired} onChange={e=>set("poRequired")(e.target.checked)} style={{width:16,height:16,accentColor:GOLD,cursor:"pointer"}}/>
        Require a PO / reference number on this account's jobs
      </label>
    </>:<>
      <div style={{borderTop:`1px solid ${BD}`,margin:"6px 0 14px"}}/>
      <div style={{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Partner <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional — for couples, e.g. engagement / wedding)</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Input label="Partner name" value={f.partnerName||""} onChange={set("partnerName")} placeholder="Richard Lee"/>
        <Input label="Partner phone" value={f.partnerPhone||""} onChange={set("partnerPhone")} placeholder="0413 222 111"/>
        <Input label="Partner email" value={f.partnerEmail||""} onChange={set("partnerEmail")} placeholder="richard@example.com"/>
      </div>
    </>}
    <div style={{borderTop:`1px solid ${BD}`,margin:"6px 0 16px"}}/>
    <Input label="Street address" value={f.street||""} onChange={set("street")} placeholder="123 Main St"/>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0 16px"}}>
      <Input label="City / Suburb" value={f.city||""} onChange={set("city")} placeholder="Sydney"/>
      <Input label="State" value={f.state||""} onChange={set("state")} placeholder="NSW"/>
      <Input label="Postcode" value={f.postcode||""} onChange={set("postcode")} placeholder="2000"/>
    </div>
    <div style={{borderTop:`1px solid ${BD}`,margin:"6px 0 16px"}}/>
    <Input label="Instructions, notes & additional information" value={f.notes} onChange={set("notes")} as="textarea" rows={3}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn ghost onClick={onCancel}>Cancel</Btn>
      <Btn onClick={()=>{if(!f.name.trim())return alert(trade?"Business name required":"Name required");onSave(f);}}>Save client</Btn>
    </div>
  </div>;
}

function Clients({clients,setClients,jobs,payments,setView,setSelClient,quotes=[],biz}){
  const isMobile=useIsMobile();
  const[modal,setModal]=useState(null);
  const[search,setSearch]=useState("");
  const filtered=clients.filter(c=>{const s=search.toLowerCase();return [c.name,c.partnerName,c.email,c.partnerEmail,c.contactName,c.abn].filter(Boolean).some(v=>v.toLowerCase().includes(s));})
    .sort((a,b)=>(a.name||"").localeCompare(b.name||"",undefined,{sensitivity:"base"}));
  const save_=(f,id)=>{if(!guardEdit())return;setClients(p=>{const n=id?p.map(c=>c.id===id?{...c,...f}:c):[...p,{...f,id:uid(),createdAt:today()}];persist(K.cl,n);return n;});setModal(null);};
  const del=id=>{
    const jobCount=jobs.filter(j=>j.clientId===id).length;
    const msg=jobCount>0
      ?`This client has ${jobCount} job${jobCount!==1?"s":""}. Deleting the client will leave ${jobCount!==1?"those jobs":"that job"} without an owner. Delete anyway?`
      :"Delete this client?";
    if(!confirm(msg))return;
    setClients(p=>{const n=p.filter(c=>c.id!==id);persist(K.cl,n);return n;});
  };
  return <div>
    <SectionHeader eyebrow="Client book" title="Clients" subtitle="Everyone you work with — contacts, jobs and history in one place." action={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{(biz?.googleReviewUrl||"").trim()&&<BulkReviewButton clients={clients} jobs={jobs} payments={payments} biz={biz} setClients={setClients}/>}<Btn onClick={()=>setModal("add")}>+ Add client</Btn></div>}/>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, partner or email…" style={{...SS.inp,marginBottom:16,marginTop:0}}/>
    {filtered.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"14px 0"}}>No clients found.</div></Card>}
    {filtered.map(c=>{
      const cj=jobs.filter(j=>j.clientId===c.id);
      const spent=cj.flatMap(j=>payments.filter(p=>p.jobId===j.id&&p.status==="Received")).reduce((s,p)=>s+Number(p.amount),0);
      const received=spent+cj.reduce((s,j)=>s+jobTradeInCredit(j,quotes),0);   // cash + gold trade-in
      return <Card key={c.id} onClick={()=>{setSelClient(c.id);setView("clientDetail");}}>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"flex-start",gap:isMobile?12:0}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start",flex:1,minWidth:0}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:GOLD_L,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:GOLD_D,flexShrink:0}}>{c.name.charAt(0)}</div>
            <div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:15,color:INK,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{clientDisplayName(c)}{c.accountType==="trade"&&<span style={{fontSize:9,fontWeight:800,letterSpacing:"0.08em",color:GOLD_D,background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:999,padding:"2px 7px",textTransform:"uppercase"}}>Trade</span>}</div>
            <div style={{fontSize:12,color:WG,marginTop:2,overflowWrap:"anywhere"}}>{c.email} · {c.phone}</div>
            <div style={{display:"flex",gap:12,fontSize:12,color:WG,marginTop:4,flexWrap:"wrap"}}>
              {received>0&&<span>Received: <b style={{color:OK}}>{fmt(received)}</b></span>}
            </div></div>
          </div>
          <div style={{display:"flex",flexDirection:isMobile?"row":"column",gap:8,alignItems:"center",justifyContent:isMobile?"flex-start":"flex-end",flexShrink:0}}>
            <Badge label={`${cj.length} job${cj.length!==1?"s":""}`} color={WG}/>
            <div style={{display:"flex",gap:6,marginLeft:isMobile?"auto":0}} onClick={e=>e.stopPropagation()}>
              <Btn sm ghost onClick={()=>setModal(c)}>Edit</Btn>
              <Btn sm danger onClick={()=>del(c.id)}>×</Btn>
            </div>
          </div>
        </div>
      </Card>;
    })}
    {modal&&<Modal title={modal==="add"?"New client":"Edit client"} onClose={()=>setModal(null)}>
      <ClientForm initial={modal==="add"?{}:modal} onSave={f=>save_(f,modal==="add"?null:modal.id)} onCancel={()=>setModal(null)}/>
    </Modal>}
  </div>;
}

function ClientDetail({clientId,clients,setClients,jobs,setJobs,quotes,payments,invoices,markupTable,setView,setSelJob,biz}){
  const isMobile=useIsMobile();
  const c=clients.find(x=>x.id===clientId);
  const[jobModal,setJobModal]=useState(false);
  const[editModal,setEditModal]=useState(false);
  const saveClient=f=>{if(!guardEdit())return;setClients(p=>{const n=p.map(x=>x.id===clientId?{...x,...f}:x);persist(K.cl,n);return n;});setEditModal(false);};
  if(!c)return null;
  const addJob=f=>{if(!guardEdit())return;const id=uid();setJobs(p=>{const n=[...p,{...f,id,createdAt:today()}];persist(K.jo,n);return n;});setJobModal(false);setSelJob(id);setView("jobDetail");};
  const cj=jobs.filter(j=>j.clientId===clientId);
  const spent=cj.flatMap(j=>payments.filter(p=>p.jobId===j.id&&p.status==="Received")).reduce((s,p)=>s+Number(p.amount),0);
  const charged=cj.reduce((s,j)=>s+jobChargeTotal(j,quotes,markupTable,invoices),0);
  const tradeIn=cj.reduce((s,j)=>s+jobTradeInCredit(j,quotes),0);
  const owing=Math.max(0,charged-spent-tradeIn);   // trade-in credits count toward what's covered
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
      <div style={{width:isMobile?42:50,height:isMobile?42:50,borderRadius:"50%",background:GOLD_L,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?17:20,fontWeight:800,color:GOLD_D,flexShrink:0}}>{c.name.charAt(0)}</div>
      <div style={{flex:1,minWidth:0}}><h1 style={{margin:0,fontSize:isMobile?19:24,fontWeight:800,color:INK,letterSpacing:"-0.02em",wordBreak:"break-word",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>{clientDisplayName(c)}{c.accountType==="trade"&&<span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",color:GOLD_D,background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:999,padding:"3px 9px",textTransform:"uppercase"}}>Trade account</span>}</h1>
      <div style={{fontSize:13,color:WG}}>Since {fmtDate(c.createdAt)} · {fmt(spent+tradeIn)} received to date</div></div>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        {(biz?.googleReviewUrl||"").trim()&&<ReviewRequestButton to={c?.email} clientName={clientDisplayName(c)} biz={biz} clientId={clientId} setClients={setClients}/>}
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>setEditModal(true)} >✎ Edit</Btn>
      </div>
    </div>
    {charged>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
      {[["Total charged",fmt(charged),INK],["Received",fmt(spent+tradeIn),OK],["Outstanding",fmt(owing),owing>0.5?WARN:OK]].map(([l,v,col])=>(
        <div key={l} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
          <div style={{fontSize:20,fontWeight:800,color:col,marginTop:3}}>{v}</div>
        </div>
      ))}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
      <Card style={{margin:0}}>
        <div style={SS.lbl}>Contact</div>
        {[
          [c.partnerName?`${c.name} — email`:"Email",c.email],
          [c.partnerName?`${c.name} — phone`:"Phone",c.phone],
          ...(c.partnerName?[[`${c.partnerName} — email`,c.partnerEmail],[`${c.partnerName} — phone`,c.partnerPhone]]:[]),
          ["Address",c.street?[c.street,c.city,c.state,c.postcode].filter(Boolean).join(", "):(c.address||"")],
          ["Client since",fmtDate(c.createdAt)],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"7px 0",borderBottom:`1px solid ${BD}`}}><span style={{color:WG}}>{k}</span><span style={{color:INK,fontWeight:600}}>{v||"—"}</span></div>
        ))}
      </Card>
      <Card style={{margin:0}}>
        <div style={SS.lbl}>{c.accountType==="trade"?"Trade account":"Preferences"}</div>
        {c.accountType==="trade"?<>
          {[
          ["Contact person",c.contactName],
          [TAX_ID_LABEL,c.abn],
          ["Terms",c.terms],
          ["Credit limit",c.creditLimit?fmt(Number(c.creditLimit)):""],
          ["PO required",c.poRequired?"Yes":"No"],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"7px 0",borderBottom:`1px solid ${BD}`}}><span style={{color:WG}}>{k}</span><span style={{color:INK,fontWeight:600}}>{v||"—"}</span></div>
        ))}
          {(()=>{const bal=accountAging(c,jobs,invoices,payments,today()).total;return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,padding:"9px 0 2px"}}><span style={{color:WG}}>Balance owing</span><span style={{fontWeight:800,color:bal>0?INK:OK}}>{fmt(bal)}</span></div>;})()}
          <div style={{marginTop:12}}><Btn sm ghost onClick={()=>setView("statementDetail_"+c.id)}>View statement →</Btn></div>
        </>:<div style={{fontSize:13,color:WG,padding:"7px 0"}}>—</div>}
      </Card>
    </div>
    {c.notes&&<Card><div style={{...SS.lbl,marginBottom:8}}>Notes</div><div style={{fontSize:14,color:INK,lineHeight:1.7}}>{c.notes}</div></Card>}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={SS.lbl}>Jobs ({cj.length})</div>
        <Btn sm onClick={()=>setJobModal(true)}>+ New job</Btn>
      </div>
      {cj.length===0&&<div style={{color:WG,fontSize:14}}>No jobs yet.</div>}
      {cj.map(j=>(
        <div key={j.id} onClick={()=>{setSelJob(j.id);setView("jobDetail");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${BD}`,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background=PARCH} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <div><div style={{fontWeight:600,fontSize:14,color:INK}}>{j.type}</div><div style={{fontSize:12,color:WG,marginTop:2}}>{j.deadline?`Due ${fmtDate(j.deadline)}`:"No due date"}</div></div>
          <Badge label={j.stage} color={SC[j.stage]||WG}/>
        </div>
      ))}
    </Card>
    {jobModal&&<Modal title={`New job for ${c.name}`} onClose={()=>setJobModal(false)}>
      <JobForm clients={clients} initial={{clientId}} onSave={addJob} onCancel={()=>setJobModal(false)}/>
    </Modal>}
    {editModal&&<Modal title="Edit client" onClose={()=>setEditModal(false)}>
      <ClientForm initial={c} onSave={saveClient} onCancel={()=>setEditModal(false)}/>
    </Modal>}
  </div>;
}

// ── Jobs ──────────────────────────────────────────────────────────────────
function JobForm({clients,initial={},onSave,onCancel}){
  const[f,setF]=useState({clientId:"",type:JOB_TYPES[0],stage:JOB_STAGES[0],description:"",deadline:"",dateIn:"",dateOut:"",notes:"",supplier:"",supplierRef:"",totalOverride:"",po:"",...initial});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const selClient=clients.find(c=>c.id===f.clientId);
  const isTradeJob=selClient?.accountType==="trade";
  // Trade jobs are priced from the client's account type, not the job type, so leave the type free:
  // a trade client's job can be a Repair (with its intake), an engagement ring, etc. "Trade / Wholesale"
  // stays available in the list as a manual catch-all.
  return <div>
    <Input label="Client" value={f.clientId} onChange={set("clientId")} as="select" options={[{value:"",label:"— Select a client —"},...clients.map(c=>({value:c.id,label:c.accountType==="trade"?`${c.name} · Trade`:c.name}))]}/>
    {isTradeJob&&<Input label={`PO / reference${selClient?.poRequired?" (required)":""}`} value={f.po||""} onChange={set("po")} placeholder="Client's PO or job reference"/>}
    <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr",gap:"0 16px"}}>
      <Input label="Job type" value={f.type} onChange={set("type")} as="select" options={JOB_TYPES}/>
      <Input label="Stage" value={f.stage} onChange={set("stage")} as="select" options={JOB_STAGES}/>
      <Input label="Due date (optional)" value={f.deadline} onChange={set("deadline")} type="date"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label="Date taken in" value={f.dateIn} onChange={set("dateIn")} type="date"/>
      <Input label="Date of pickup / collection" value={f.dateOut} onChange={set("dateOut")} type="date"/>
    </div>
    <div style={{borderTop:`1px solid ${BD}`,margin:"6px 0 16px"}}/>
    <div style={{background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:4,padding:"12px 16px",marginBottom:16}}>
      <Input label={`Total charge override (${CUR_SYM}) — optional`} value={f.totalOverride||""} onChange={set("totalOverride")} type="number" min="0" step="0.01" placeholder="e.g. 4500"/>
      <div style={{fontSize:11,color:GOLD_D,marginTop:-6,lineHeight:1.5}}>Set this when the sale was agreed outside the CRM (no quote needed). The CRM uses it as the job's total for balances, overview &amp; reports. Leave blank to use approved quotes instead.</div>
    </div>
    <Input label="Job description" value={f.description} onChange={set("description")} as="textarea" rows={3} placeholder="Describe the piece, specifications, materials…"/>
    <div style={{marginBottom:14}}>
      <label style={{...SS.lbl,marginBottom:6}}>Internal notes <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(not visible to client)</span></label>
      <textarea value={f.notes} onChange={e=>set("notes")(e.target.value)} rows={2} style={{...SS.inp,marginTop:0,resize:"vertical"}}/>
    </div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn ghost onClick={onCancel}>Cancel</Btn>
      <Btn onClick={()=>{if(!f.clientId)return alert("Select a client");if(isTradeJob&&selClient?.poRequired&&!(f.po||"").trim())return alert("This trade account requires a PO / reference number.");onSave(f);}}>Save job</Btn>
    </div>
  </div>;
}

function Jobs({clients,jobs,setJobs,quotes,setQuotes,payments,setPayments,notes,setNotes,invoices,setInvoices,markupTable,setView,setSelJob,preset,onPresetDone,proposals=[],biz}){
  const[modal,setModal]=useState(null);
  const[sf,setSf]=useState("All");
  const[tf,setTf]=useState("All");
  const[search,setSearch]=useState("");
  const[awaitOnly,setAwaitOnly]=useState(false);   // filter to only "awaiting client" (parked) jobs
  const[owingOnly,setOwingOnly]=useState(false);    // filter to jobs with a balance owing
  const[overdueOnly,setOverdueOnly]=useState(false);// filter to overdue jobs
  const[chaseOnly,setChaseOnly]=useState(false);    // filter to quotes to chase (sent proposal 7+ days, no reply)
  // A job "to chase": a proposal sent 7+ days ago with no acceptance and no approved quote yet.
  const isChase=j=>{
    if(j.stage==="Collected"||j.parked)return false;
    const jp=proposals.filter(p=>p.jobId===j.id);
    if(jp.some(p=>p.status==="accepted"))return false;
    if(quotes.some(q=>q.jobId===j.id&&q.status==="Approved"))return false;
    const sent=jp.filter(p=>p.status==="sent"&&p.createdAt).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    if(!sent.length)return false;
    return Math.round((Date.now()-parseISO(sent[0].createdAt).getTime())/86400000)>=7;
  };
  const[frozenOnly,setFrozenOnly]=useState(false);   // filter to expired/ignored ("frozen") quotes
  // A "frozen" job — the same set the dashboard hides: a sent proposal past its expiry (createdAt +
  // your quote-validity window), no acceptance, no approved quote and no money in.
  const jobFrozen=j=>{
    if(j.stage==="Collected"||j.parked)return false;
    const jp=proposals.filter(p=>p.jobId===j.id);
    const sent=jp.filter(p=>p.status==="sent");
    if(!sent.length||jp.some(p=>p.status==="accepted"))return false;
    if(quotes.some(q=>q.jobId===j.id&&q.status==="Approved"))return false;
    const cash=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
    if(cash>0||jobTradeInCredit(j,quotes)>0)return false;
    const vd=biz?.quoteValidityDays||30;
    return sent.every(p=>p.createdAt&&addDays(String(p.createdAt).slice(0,10),vd)<today());
  };
  // Apply a one-off filter sent from the dashboard tiles (ready / owing / overdue / a stage name),
  // resetting the others, then clear it in the parent so it doesn't re-fire on the next visit.
  useEffect(()=>{
    if(!preset)return;
    setSearch("");setTf("All");setAwaitOnly(false);
    setOwingOnly(preset==="owing");
    setOverdueOnly(preset==="overdue");
    setChaseOnly(preset==="chase");
    setFrozenOnly(preset==="frozen");
    setSf(preset==="ready"?"Ready for collection":(preset==="owing"||preset==="overdue"||preset==="chase"||preset==="frozen")?"All":preset);
    onPresetDone&&onPresetDone();
  },[preset]);   // eslint-disable-line
  const[mode,setMode]=useState("list");        // list | board (production board)
  const isMobile=useIsMobile();
  // The board is drag-and-drop, which isn't practical on touch — force List on mobile
  // and hide the toggle. Board stays fully available on desktop.
  const vMode=isMobile?"list":mode;
  const[dragOver,setDragOver]=useState(null);   // stage column being dragged over
  const moveJobToStage=(id,stage)=>{setJobs(p=>{const n=p.map(j=>j.id===id&&j.stage!==stage?{...j,stage}:j);persist(K.jo,n);return n;});};
  const typeCounts=useMemo(()=>{const m={};jobs.forEach(j=>{m[j.type]=(m[j.type]||0)+1;});return m;},[jobs]);
  const parkedCount=useMemo(()=>jobs.filter(j=>j.parked).length,[jobs]);
  const typesByCount=useMemo(()=>Object.keys(typeCounts).sort((a,b)=>typeCounts[b]-typeCounts[a]),[typeCounts]);
  const q=search.trim().toLowerCase();
  // Every filter EXCEPT the stage chip. Split out so we can count jobs per stage without letting
  // the selected stage zero out the others.
  const passesNonStage=j=>{
    if(awaitOnly&&!j.parked)return false;
    if(overdueOnly&&!(j.deadline&&j.deadline<today()&&!jobIsDone(j)))return false;
    if(chaseOnly&&!isChase(j))return false;
    if(frozenOnly&&!jobFrozen(j))return false;
    if(owingOnly){const total=jobHasCharge(j,quotes)?jobChargeTotal(j,quotes,markupTable,invoices):0;const paid=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0)+jobTradeInCredit(j,quotes);if(total-paid<=0.5)return false;}
    if(tf!=="All"&&j.type!==tf)return false;
    if(q){
      const c=clients.find(x=>x.id===j.clientId);
      const hay=`${j.type} ${c?.name||""} ${j.description||""} ${j.stage} ${j.supplier||""}`.toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  };
  // Count per stage under the current filters (minus the stage chip) — shown on the List chips.
  const stageBase=jobs.filter(passesNonStage);
  const stageCount=s=>s==="All"?stageBase.length:stageBase.filter(j=>j.stage===s).length;
  // Most urgent first: soonest (and overdue) deadlines on top, undated jobs next, and finished
  // jobs (ready for collection / collected) always at the very bottom regardless of due date.
  // Deadlines are ISO yyyy-mm-dd strings, so a plain string compare is chronological.
  const filtered=stageBase.filter(j=>sf==="All"||j.stage===sf).sort((a,b)=>{
    const ad_done=jobIsDone(a),bd_done=jobIsDone(b);
    if(ad_done!==bd_done)return ad_done?1:-1;
    const ad=a.deadline||"",bd=b.deadline||"";
    if(!ad&&!bd)return 0;
    if(!ad)return 1;
    if(!bd)return -1;
    return ad.localeCompare(bd);
  });
  const add=f=>{if(!guardEdit())return;setJobs(p=>{const n=[...p,{...f,id:uid(),createdAt:today()}];persist(K.jo,n);return n;});setModal(null);};
  const delJob=(id,e)=>{
    e.stopPropagation();
    if(!confirm("Delete this job? This will also remove all related quotes, payments, notes and invoices."))return;
    setJobs(p=>{const n=p.filter(j=>j.id!==id);persist(K.jo,n);return n;});
    setQuotes(p=>{const n=p.filter(q=>q.jobId!==id);persist(K.qu,n);return n;});
    setPayments(p=>{const n=p.filter(x=>x.jobId!==id);persist(K.pa,n);return n;});
    setNotes(p=>{const n=p.filter(x=>x.jobId!==id);persist(K.no,n);return n;});
    setInvoices(p=>{const n=p.filter(x=>x.jobId!==id);persist(K.inv,n);return n;});
  };
  return <div>
    <SectionHeader eyebrow="Workshop" title="Jobs" subtitle="Every custom piece in progress, by type and stage." action={clients.length>0?<Btn onClick={()=>setModal("add")}>+ Add job</Btn>:<span style={{fontSize:13,color:WG}}>Add a client first</span>}/>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search jobs by client, type or description…" style={{...SS.inp,marginBottom:14,marginTop:0}}/>
    {typesByCount.length>0&&<div style={{marginBottom:16}}>
      <div style={{...SS.lbl,marginBottom:10}}>Job types</div>
      {/* Wider columns (min 176px) give long type names ("Trade / Wholesale") room to sit on one line
          instead of cramming; the large Stat tiles are kept. */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(176px,1fr))",gap:12}}>
        <div style={{borderRadius:RADIUS,boxShadow:tf==="All"?`0 0 0 2px ${GOLD}`:"none"}}>
          <Stat tint="slate" icon={ICON_ALLJOBS} value={jobs.length} label="All jobs" onClick={()=>setTf("All")}/>
        </div>
        {typesByCount.map(t=>(
          <div key={t} style={{borderRadius:RADIUS,boxShadow:tf===t?`0 0 0 2px ${GOLD}`:"none"}}>
            <Stat tint="slate" icon={JOB_TYPE_ICONS[t]||"◎"} value={typeCounts[t]} label={t} onClick={()=>setTf(tf===t?"All":t)}/>
          </div>
        ))}
      </div>
    </div>}
    {/* List / Board view toggle — hidden on mobile (board needs drag-and-drop) */}
    {!isMobile&&<div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
      {[["list","☰ List"],["board","▦ Board"]].map(([m,label])=>(
        <button key={m} onClick={()=>setMode(m)} style={{padding:"6px 16px",borderRadius:3,border:`1px solid ${mode===m?INK:BD}`,background:mode===m?INK:"transparent",color:mode===m?WHITE:WG,fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
      ))}
      {mode==="board"&&<span style={{fontSize:11,color:WG,marginLeft:6}}>Drag a card to move it to another stage.</span>}
    </div>}
    {vMode==="list"&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {["All",...JOB_STAGES].map(s=>{const n=stageCount(s);return <button key={s} onClick={()=>setSf(s)} style={{padding:"4px 11px",borderRadius:3,border:`1px solid ${sf===s?GOLD:BD}`,background:sf===s?GOLD:"transparent",color:sf===s?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{s}{n>0?<span style={{opacity:0.65,fontWeight:600}}> ({n})</span>:""}</button>;})}
    </div>}
    {vMode==="list"&&<div style={{marginBottom:14,display:"flex",gap:6,flexWrap:"wrap"}}>
      <button onClick={()=>setOverdueOnly(v=>!v)} style={{padding:"4px 11px",borderRadius:3,border:`1px solid ${overdueOnly?DANGER:BD}`,background:overdueOnly?DANGER:"transparent",color:overdueOnly?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⏰ Overdue</button>
      <button onClick={()=>setOwingOnly(v=>!v)} style={{padding:"4px 11px",borderRadius:3,border:`1px solid ${owingOnly?WARN:BD}`,background:owingOnly?WARN:"transparent",color:owingOnly?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>$ Owing</button>
      <button onClick={()=>setChaseOnly(v=>!v)} style={{padding:"4px 11px",borderRadius:3,border:`1px solid ${chaseOnly?GOLD_D:BD}`,background:chaseOnly?GOLD_D:"transparent",color:chaseOnly?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📨 To chase</button>
      {parkedCount>0&&<button onClick={()=>setAwaitOnly(v=>!v)} style={{padding:"4px 11px",borderRadius:3,border:`1px solid ${awaitOnly?WARN:BD}`,background:awaitOnly?WARN:"transparent",color:awaitOnly?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⏸ Awaiting client ({parkedCount})</button>}
    </div>}
    {vMode==="list"&&(q||tf!=="All"||sf!=="All"||awaitOnly||owingOnly||overdueOnly||chaseOnly||frozenOnly)&&<div style={{fontSize:12,color:WG,marginBottom:12}}>Showing <b style={{color:INK}}>{filtered.length}</b> of {jobs.length} job{jobs.length!==1?"s":""}{tf!=="All"?` · ${tf}`:""}{sf!=="All"?` · ${sf}`:""}{awaitOnly?" · Awaiting client":""}{overdueOnly?" · Overdue":""}{owingOnly?" · Owing":""}{chaseOnly?" · To chase":""}{frozenOnly?" · Expired quotes":""}{q?` · “${search.trim()}”`:""}<button onClick={()=>{setSearch("");setTf("All");setSf("All");setAwaitOnly(false);setOwingOnly(false);setOverdueOnly(false);setChaseOnly(false);setFrozenOnly(false);}} style={{background:"none",border:"none",color:GOLD,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginLeft:8,padding:0}}>Clear</button></div>}

    {/* ── Production board ── */}
    {vMode==="board"&&(()=>{
      const byStage={};JOB_STAGES.forEach(s=>byStage[s]=[]);
      filtered.forEach(j=>{(byStage[j.stage]=byStage[j.stage]||[]).push(j);});
      return <div style={{display:"flex",gap:14,overflowX:"auto",paddingBottom:18,width:"100%"}}>
        {JOB_STAGES.map(s=>{
          const col=byStage[s]||[];const isOver=dragOver===s;const sc=SC[s]||WG;
          return <div key={s}
            onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";if(dragOver!==s)setDragOver(s);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(d=>d===s?null:d);}}
            onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain");if(id)moveJobToStage(id,s);setDragOver(null);}}
            style={{width:264,flexShrink:0,background:isOver?sc+"18":PARCH,border:`1px solid ${isOver?sc:BD}`,borderRadius:5,padding:"12px 12px 14px",display:"flex",flexDirection:"column",gap:10,alignSelf:"flex-start"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"0 2px 10px",borderBottom:`2px solid ${sc}`}}>
              <span style={{fontSize:12,fontWeight:800,color:sc,textTransform:"uppercase",letterSpacing:"0.03em",lineHeight:1.25}}>{s}</span>
              <span style={{fontSize:12,fontWeight:800,color:WG,background:WHITE,borderRadius:5,padding:"2px 10px",flexShrink:0}}>{col.length}</span>
            </div>
            {col.length===0&&<div style={{fontSize:12,color:"#C8C4BE",textAlign:"center",padding:"14px 0"}}>No jobs</div>}
            {col.map(j=>{
              const c=clients.find(x=>x.id===j.clientId);
              const od=j.deadline&&j.deadline<today()&&!jobIsDone(j);
              return <div key={j.id} draggable
                onDragStart={e=>{e.dataTransfer.setData("text/plain",j.id);e.dataTransfer.effectAllowed="move";}}
                onClick={()=>{setSelJob(j.id);setView("jobDetail");}}
                style={{background:WHITE,border:`1px solid ${BD}`,borderLeft:`4px solid ${sc}`,borderRadius:9,padding:"12px 14px",cursor:"grab",boxShadow:"0 1px 3px rgba(20,20,22,0.06)"}}>
                <div style={{fontSize:14.5,fontWeight:700,color:INK,lineHeight:1.3}}>{j.type}</div>
                <div style={{fontSize:12.5,color:WG,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{clientDisplayName(c)||"—"}</div>
                {j.deadline&&<div style={{fontSize:11.5,color:od?DANGER:WG,marginTop:7,fontWeight:od?700:600}}>Due {fmtDate(j.deadline)}{od?" · OVERDUE":""}</div>}
                {j.parked&&<div style={{fontSize:11,color:WARN,marginTop:6,fontWeight:700}}>⏸ Awaiting client</div>}
              </div>;
            })}
          </div>;
        })}
      </div>;
    })()}

    {vMode==="list"&&filtered.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"14px 0"}}>No jobs found{q?` for “${search.trim()}”`:""}.</div></Card>}
    {vMode==="list"&&filtered.map(j=>{
      const c=clients.find(x=>x.id===j.clientId);
      const od=j.deadline&&j.deadline<today()&&!jobIsDone(j);
      const total=jobChargeTotal(j,quotes,markupTable,invoices);
      const paid=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
      const tradeIn=jobTradeInCredit(j,quotes);            // gold trade-in credit (value received)
      const owing=total-paid-tradeIn;
      const isOverride=Number(j.totalOverride)>0;
      return <Card key={j.id} onClick={()=>{setSelJob(j.id);setView("jobDetail");}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:2}}>{j.type} <span style={{color:WG,fontWeight:400,fontSize:13}}>· {clientDisplayName(c)}</span></div>
          <div style={{fontSize:12,color:od?DANGER:WG,marginBottom:5}}>{j.deadline?`Due ${fmtDate(j.deadline)}${od?" — OVERDUE":""}`:"No due date"}</div>
          {j.description&&<div style={{fontSize:13,color:INK}}>{j.description.slice(0,90)}{j.description.length>90?"…":""}</div>}</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <Badge label={j.stage} color={SC[j.stage]||WG}/>
            {j.parked&&<Badge label="Awaiting client" color={WARN}/>}
            <button onClick={e=>delJob(j.id,e)} style={{background:"none",border:`1px solid ${DANGER}44`,borderRadius:2,padding:"3px 10px",fontSize:11,color:DANGER,cursor:"pointer",fontFamily:"inherit",fontWeight:700,letterSpacing:"0.04em",opacity:0.7}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.7}>Delete</button>
          </div>
        </div>
        {total>0&&<div style={{display:"flex",gap:18,marginTop:12,paddingTop:10,borderTop:`1px solid ${BD}`,fontSize:12,flexWrap:"wrap"}}>
          <span style={{color:WG}}>Total <b style={{color:INK}}>{fmt(total)}</b>{isOverride&&<span style={{color:GOLD_D,fontSize:10,fontWeight:700,marginLeft:5,letterSpacing:"0.04em"}}>OVERRIDE</span>}</span>
          <span style={{color:WG}}>Received <b style={{color:OK}}>{fmt(paid+tradeIn)}</b></span>
          {owing>0.5&&<span style={{color:WG}}>Owing <b style={{color:WARN}}>{fmt(owing)}</b></span>}
          {owing<=0.5&&total>0&&<span style={{color:OK,fontWeight:700}}>✓ Paid in full</span>}
        </div>}
      </Card>;
    })}
    {modal&&<Modal title="New job" onClose={()=>setModal(null)}><JobForm clients={clients} onSave={add} onCancel={()=>setModal(null)}/></Modal>}
  </div>;
}

// ── Activity log ──────────────────────────────────────────────────────────
function ActivityLog({jobId,notes,setNotes}){
  const[open,setOpen]=useState(true);
  const[form,setForm]=useState({type:NOTE_TYPES[0],text:"",date:today()});
  const jn=notes.filter(n=>n.jobId===jobId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const NTC={"Client call":"#4E8B6A","Client email":"#5E9078","Client visit":"#96627C","Approval received":"#2D7A4F","Internal update":"#888780","General note":"#6B6560"};
  const add=()=>{if(!guardEdit())return;if(!form.text.trim())return;const n={...form,id:uid(),jobId,createdAt:new Date().toISOString()};setNotes(p=>{const nw=[...p,n];persist(K.no,nw);return nw;});setForm(f=>({...f,text:""}));};
  const del=id=>{setNotes(p=>{const n=p.filter(x=>x.id!==id);persist(K.no,n);return n;});};
  return <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:open?16:0}}>
      <div style={{fontWeight:700,fontSize:15,color:INK}}>Job notes ({jn.length})</div>
      <Btn sm ghost onClick={()=>setOpen(v=>!v)}>{open?"Hide":"Show"}</Btn>
    </div>
    {open&&<>
      <div style={{marginBottom:10}}>
        <label style={SS.lbl}>Note</label>
        <textarea value={form.text} onChange={e=>setForm(f=>({...f,text:e.target.value}))} placeholder="Add a note, call log, approval, or update…" rows={3} style={{...SS.inp,resize:"vertical"}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px",marginBottom:12}}>
        <Input label="Type" value={form.type} onChange={v=>setForm(f=>({...f,type:v}))} as="select" options={NOTE_TYPES}/>
        <Input label="Date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} type="date"/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <Btn sm onClick={add}>Add note</Btn>
      </div>
      {jn.length>0&&<div style={{marginTop:16}}>
        {jn.map(n=>(
          <div key={n.id} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${BD}`}}>
            <div style={{width:3,background:NTC[n.type]||WG,borderRadius:2,flexShrink:0,alignSelf:"stretch",minHeight:20}}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                <Badge label={n.type} color={NTC[n.type]||WG}/><span style={{fontSize:12,color:WG}}>{fmtDate(n.date)}</span>
              </div>
              <div style={{fontSize:13,color:INK,lineHeight:1.6}}>{n.text}</div>
            </div>
            <button onClick={()=>del(n.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:15,padding:0,alignSelf:"flex-start"}}>×</button>
          </div>
        ))}
      </div>}
    </>}
  </Card>;
}

// ── Job image gallery ─────────────────────────────────────────────────────
function JobImages({job,setJobs}){
  const images=job.images||[];
  const[urls,setUrls]=useState({});
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState("");
  const[lightbox,setLightbox]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!imagesEnabled()||!images.length)return;
      const map={};
      for(const img of images){
        const u=await signedImageUrl(img.path);
        if(u)map[img.path]=u;
      }
      if(!cancelled)setUrls(map);
    })();
    return()=>{cancelled=true;};
  },[job.id,images.map(i=>i.path).join(",")]);

  const saveImages=(next)=>setJobs(p=>{const n=p.map(j=>j.id===job.id?{...j,images:next}:j);persist(K.jo,n);return n;});

  const onFiles=async(fileList)=>{
    const files=Array.from(fileList||[]).filter(f=>f.type.startsWith("image/"));
    if(!files.length)return;
    setErr("");setBusy(true);
    try{
      const added=[];
      for(const file of files){
        const blob=await compressImage(file);
        const path=await uploadJobImage(job.id,blob);
        const u=await signedImageUrl(path);
        added.push({id:uid(),path,name:file.name,caption:"",uploadedAt:new Date().toISOString()});
        if(u)setUrls(prev=>({...prev,[path]:u}));
      }
      saveImages([...images,...added]);
    }catch(e){setErr(e.message||"Upload failed.");}
    setBusy(false);
  };

  const removeImg=async(img)=>{
    if(!confirm("Remove this image?"))return;
    saveImages(images.filter(i=>i.id!==img.id));
    deleteJobImage(img.path);
  };
  const setCaption=(img,caption)=>saveImages(images.map(i=>i.id===img.id?{...i,caption}:i));

  if(!imagesEnabled())return <Card>
    <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:6}}>Images</div>
    <div style={{fontSize:13,color:WG,lineHeight:1.6}}>Image uploads need the cloud backend. Sign in on the deployed app to add photos.</div>
  </Card>;

  return <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:15,color:INK}}>Images ({images.length})</div>
      <label style={{background:GOLD,color:WHITE,borderRadius:4,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:busy?"default":"pointer",fontFamily:"inherit",letterSpacing:"0.02em",opacity:busy?0.6:1}}>
        {busy?"Uploading…":"+ Upload images"}
        <input type="file" accept="image/*" multiple disabled={busy} onChange={e=>{onFiles(e.target.files);e.target.value="";}} style={{display:"none"}}/>
      </label>
    </div>
    {err&&<div style={{background:DANGER+"15",border:`1px solid ${DANGER}44`,color:DANGER,fontSize:12,padding:"8px 12px",borderRadius:4,marginBottom:12}}>{err}</div>}
    {images.length===0&&!busy&&<div style={{fontSize:13,color:WG,fontStyle:"italic",padding:"8px 0"}}>No images yet. Upload reference shots, CAD renders, progress photos or the finished piece.</div>}
    {images.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
      {images.map(img=>(
        <div key={img.id} style={{border:`1px solid ${BD}`,borderRadius:4,overflow:"hidden",background:PARCH}}>
          <div onClick={()=>urls[img.path]&&setLightbox(urls[img.path])} style={{width:"100%",height:130,background:`#EEE center/cover no-repeat`,backgroundImage:urls[img.path]?`url(${urls[img.path]})`:"none",cursor:urls[img.path]?"zoom-in":"default",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {!urls[img.path]&&<span style={{fontSize:11,color:WG}}>loading…</span>}
          </div>
          <div style={{padding:"7px 8px"}}>
            {img.name&&<div title={img.name} style={{fontSize:10.5,fontWeight:600,color:INK,marginBottom:6,lineHeight:1.35,wordBreak:"break-word"}}>{img.name}</div>}
            <input value={img.caption||""} onChange={e=>setCaption(img,e.target.value)} placeholder="Add caption…" style={{...SS.inp,marginTop:0,fontSize:11,padding:"4px 7px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
              <span style={{fontSize:10,color:WG}}>{fmtDate(img.uploadedAt)}</span>
              <button onClick={()=>removeImg(img)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:11,fontWeight:700,fontFamily:"inherit",padding:0}}>Remove</button>
            </div>
          </div>
        </div>
      ))}
    </div>}
    {lightbox&&<div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"30px 16px",cursor:"zoom-out"}}>
      <button onClick={e=>{e.stopPropagation();setLightbox(null);}} aria-label="Close image" style={{position:"fixed",top:14,right:14,width:46,height:46,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.5)",color:WHITE,fontSize:26,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:601}}>×</button>
      <img src={lightbox} alt="" style={{maxWidth:"100%",maxHeight:"100%",borderRadius:4,boxShadow:"0 20px 80px rgba(0,0,0,0.6)"}}/>
      <div style={{position:"fixed",bottom:16,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:12,pointerEvents:"none"}}>Tap the image or ✕ to close</div>
    </div>}
  </Card>;
}

function RepairIntakeCard({job,setJobs,biz,clients,markupTable,pricing=[],invoices=[],setInvoices,setView}){
  const isMobile=useIsMobile();
  const c=clients.find(x=>x.id===job.clientId);
  const intake=job.intake||{};
  const blankIntakeItem=()=>({id:uid(),itemType:"",damage:"",condition:"",price:"",priceMode:"set"});
  const[items,setItems]=useState(()=>{const ex=intakeItems(intake);return ex.length?ex.map(i=>({id:i.id||uid(),itemType:i.itemType||"",damage:i.damage||"",condition:i.condition||"",price:i.price!=null?String(i.price):"",priceMode:i.priceMode||"set"})):[blankIntakeItem()];});
  // Trade accounts get 10% GST added to repair prices (their prices are treated as ex-GST, GST
  // added on top); retail repair prices are used as-is (retail-ready / GST-inclusive). Retail is
  // unchanged (tradeGst = 1). Applies to both a "set" price and a "cost + markup" figure.
  const trade=c?.accountType==="trade";
  const tradeGst=trade?1+GST_RATE:1;
  // Effective customer price (inc GST) for an item: a "set" price is used as-is; a "cost"
  // is run through the manufacturing markup table (bracket multiplier, then rounded).
  const itemClient=it=>{
    const v=Number(it.price)||0;if(v<=0)return 0;
    // Cost + markup is a retail-only mode (hidden for trade); trade always prices from the set value + GST.
    if(!trade&&it.priceMode==="cost"){const b=getBracket(v,markupTable);return roundQ(v*(b?b.multiplier:1));}
    return v*tradeGst;
  };
  const itemMult=it=>{const b=getBracket(Number(it.price)||0,markupTable);return b?b.multiplier:null;};
  const[instructions,setInstructions]=useState(intake.instructions||"");
  const[dIn,setDIn]=useState(job.dateIn||"");
  const[dOut,setDOut]=useState(job.dateOut||"");
  // Gold trade-in credit against this repair (customer's own metal) — a credit received, like the
  // quote-level trade-in. Stored on the job; nets the balance and carries onto the repair invoice.
  const[tradeIn,setTradeIn]=useState(job.repairTradeIn?String(job.repairTradeIn):"");
  const[tradeInNote,setTradeInNote]=useState(job.repairTradeInNote||"");
  // Uploaded photos as inline data URLs, loaded once per image set and reused for both the
  // online link snapshot and the printed receipt (avoids re-fetching on every edit/autosave).
  const[photoData,setPhotoData]=useState([]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const ph=await jobImagesForPrint(job);
      if(cancelled)return;
      setPhotoData(ph);
      // If a client link already exists, backfill its snapshot so the photos show online
      // without the user having to re-edit or re-share.
      if(job.repairToken&&supabaseEnabled&&supabase){
        const snap=buildRepairSnapshot({job:{...job,dateIn:dIn,dateOut:dOut},client:c,biz,items:items.map(it=>({...it,clientPrice:itemClient(it)})),instructions,photos:ph});
        supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",job.repairToken).then(()=>{}).catch(()=>{});
      }
    })();
    return()=>{cancelled=true;};
  },[job.id,(job.images||[]).map(i=>i.path).join(",")]);   // eslint-disable-line
  // If a client link exists, keep its cloud snapshot in sync with edits so the link never goes stale.
  const refreshSnapshot=(itemsArg,instrArg,over)=>{
    if(!job.repairToken||!supabaseEnabled||!supabase)return;
    // `over` is a job patch merged in (dates or trade-in) so a just-changed value isn't lost to stale state.
    const snap=buildRepairSnapshot({job:{...job,dateIn:dIn,dateOut:dOut,...(over||{})},client:c,biz,items:itemsArg.map(it=>({...it,clientPrice:itemClient(it)})),instructions:instrArg,photos:photoData});
    supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",job.repairToken).then(()=>{}).catch(()=>{});
  };
  // Persist the whole intake (items + instructions) as the new shape, and refresh the link snapshot
  const saveIntake=(nextItems,nextInstr)=>{setJobs(p=>{const n=p.map(j=>j.id===job.id?{...j,intake:{items:nextItems,instructions:nextInstr}}:j);persist(K.jo,n);return n;});refreshSnapshot(nextItems,nextInstr);};
  const persistJob=patch=>{setJobs(p=>{const n=p.map(j=>j.id===job.id?{...j,...patch}:j);persist(K.jo,n);return n;});if("dateIn"in patch||"dateOut"in patch||"repairTradeIn"in patch)refreshSnapshot(items,instructions,patch);};
  const commitTradeIn=()=>persistJob({repairTradeIn:Number(tradeIn)||0,repairTradeInNote:tradeInNote.trim()});
  const setItemField=(id,k,v)=>setItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const commit=()=>saveIntake(items,instructions);
  const addItem=()=>{const ni=[...items,blankIntakeItem()];setItems(ni);saveIntake(ni,instructions);};
  const removeItem=id=>{const ni=items.filter(i=>i.id!==id);setItems(ni);saveIntake(ni,instructions);};
  const moveItem=(id,dir)=>{const i=items.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=items.length)return;const ni=[...items];[ni[i],ni[j]]=[ni[j],ni[i]];setItems(ni);saveIntake(ni,instructions);};
  const repairTotal=items.reduce((s,i)=>s+itemClient(i),0);
  const setAsCharge=()=>{persistJob({totalOverride:repairTotal});alert(`Job charge set to ${fmt(repairTotal)} from the repair items.`);};
  // Build a tax invoice straight from the repair items — each item becomes a customer-facing line.
  const createRepairInvoice=()=>{
    if(!guardEdit())return;
    if(!setInvoices)return;
    if(repairTotal<=0)return alert("Add at least one repair item with a price first.");
    if(!confirm(`Create an invoice for ${fmt(repairTotal)} from these repair items?`))return;
    commit();   // make sure the latest intake is saved first
    const priced=items.filter(it=>itemClient(it)>0);
    const customerLines=priced.map(it=>({id:uid(),description:[it.itemType,it.damage].map(s=>(s||"").trim()).filter(Boolean).join(" — ")||"Repair",amount:itemClient(it)}));
    const lineItems=priced.map(it=>({id:uid(),description:[it.itemType,it.damage].map(s=>(s||"").trim()).filter(Boolean).join(" — ")||"Repair",detail:(it.condition||"").trim(),costLow:itemClient(it).toFixed(2),noMarkup:true}));
    const totalIncGST=repairTotal;
    const gst=totalIncGST-totalIncGST/(1+GST_RATE);
    const exGST=totalIncGST-gst;
    // Use the live field values (a just-typed trade-in may not be in the job closure yet), and
    // persist them with the charge so the job balance and the invoice net the same trade-in.
    const tiCredit=Number(tradeIn)||0;   // gold trade-in nets the balance (not the GST/total)
    const tiNote=tradeInNote.trim();
    const inv={id:uid(),jobId:job.id,quoteId:null,quoteIds:[],fromRepair:true,number:nextInvoiceNumber(invoices,biz),date:today(),status:"Unpaid",exGST,gst,totalIncGST,subtotalIncGST:totalIncGST,discount:0,discountLabel:"Discount",tradeInCredit:tiCredit,tradeInNote:tiNote,lineItems,customerLines,notes:instructions||"",descriptionOverride:""};
    persistJob({totalOverride:repairTotal,repairTradeIn:tiCredit,repairTradeInNote:tiNote});   // keep the job's amount owing in sync with the invoice
    setInvoices(p=>{const n=[...p,inv];persist(K.inv,n);return n;});
    if(setView)setView("invoiceDetail_"+inv.id);
  };
  const[saved,setSaved]=useState(false);
  const[pricingFor,setPricingFor]=useState(null); // intake item id the lookup panel is open for
  const[rpSearch,setRpSearch]=useState("");
  const repairPricing=pricing.filter(p=>p.category===REPAIRS_CAT);
  const rpFiltered=rpSearch.trim()
    ?repairPricing.filter(p=>p.name.toLowerCase().includes(rpSearch.toLowerCase())||p.group?.toLowerCase().includes(rpSearch.toLowerCase()))
    :repairPricing;
  const pickRepairPrice=(item)=>{
    if(item.poa||!pricingFor)return;
    setItemField(pricingFor,"price",String(item.baseCost));
    setItemField(pricingFor,"priceMode","set");
    setTimeout(commit,0);
    setPricingFor(null);setRpSearch("");
  };
  // Shareable client link — reuses the public proposals table (same as invoices).
  const[linkBusy,setLinkBusy]=useState(false);
  const[linkCopied,setLinkCopied]=useState(false);
  const repairLink=job.repairToken?`${window.location.origin}/?p=${job.repairToken}`:"";
  const shareRepair=async()=>{
    if(!supabaseEnabled)return alert("Online links need the cloud — you appear to be in local-only mode.");
    setLinkBusy(true);
    const token=job.repairToken||proposalToken();
    // Single combined save (intake + token together) to avoid out-of-order live-sync echoes
    // that would momentarily wipe the freshly-set token. One write = the gold bar shows at once.
    setJobs(p=>{const n=p.map(j=>j.id===job.id?{...j,intake:{items,instructions},repairToken:token}:j);persist(K.jo,n);return n;});
    const photos=photoData.length?photoData:await jobImagesForPrint(job);
    const snap=buildRepairSnapshot({job:{...job,dateIn:dIn,dateOut:dOut,repairToken:token,repairTradeIn:Number(tradeIn)||0,repairTradeInNote:tradeInNote.trim()},client:c,biz,items:items.map(it=>({...it,clientPrice:itemClient(it)})),instructions,photos});
    const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).upsert({token,studio_id:_studioId,data:snap,status:"sent",created_at:new Date().toISOString()},{onConflict:"token"});
    setLinkBusy(false);
    if(error){alert("Couldn't create the link: "+error.message+"\n\nIf it mentions a missing table, the proposals Supabase setup hasn't been run.");return;}
    navigator.clipboard?.writeText(`${window.location.origin}/?p=${token}`).catch(()=>{});
    setLinkCopied(true);setTimeout(()=>setLinkCopied(false),2200);
  };
  // Client's online accept/decline response (lives on the job; kept in sync by the app-level check too)
  const response=job.repairResponse||null;
  const[checking,setChecking]=useState(false);
  const fetchResponse=async(silent)=>{
    if(!job.repairToken||!supabaseEnabled)return;
    if(!silent)setChecking(true);
    const{data}=await supabase.from(PUBLIC_PROPOSALS_TABLE).select("accepted_option,accepted_name,accepted_at").eq("token",job.repairToken).maybeSingle();
    if(!silent)setChecking(false);
    if(!data||!data.accepted_option){if(!silent)alert("No response yet — the client hasn't accepted or declined online.");return;}
    const r={decision:data.accepted_option,name:data.accepted_name||"",at:data.accepted_at||today(),seen:job.repairResponse?.seen||false};
    if(JSON.stringify(job.repairResponse||null)!==JSON.stringify(r)){
      // Move accepted repairs onto the bench automatically (declines leave the stage untouched).
      const patch={repairResponse:r};
      if(r.decision!=="declined"){const ns=advanceToBench(job.stage);if(ns!==job.stage)patch.stage=ns;}
      persistJob(patch);
    }
  };
  useEffect(()=>{if(!response)fetchResponse(true);},[job.repairToken]);   // eslint-disable-line
  const saveNow=()=>{saveIntake(items,instructions);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  return <Card id="repair-intake">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{fontWeight:700,fontSize:15,color:INK}}>Repair Intake {items.length>1&&<span style={{fontWeight:400,color:WG,fontSize:13}}>· {items.length} items</span>}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <Btn sm onClick={shareRepair}>{linkBusy?"Creating…":linkCopied?"✓ Link copied":<>{ICON_LINK}{job.repairToken?"Copy link":"Create link"}</>}</Btn>
        {job.repairToken&&<EmailClientButton to={c?.email} clientName={clientDisplayName(c)} biz={biz} linkUrl={repairLink} docType="receipt" defaultSubject={`Your receipt from ${biz?.name||"us"}`} defaultMessage={`Here is your receipt for the item(s) you've left with us. You can view it any time using the button below.`}/>}
        {job.repairToken&&<Btn sm ghost onClick={()=>window.open(repairLink,"_blank")}>Preview</Btn>}
        <Btn sm ghost onClick={()=>printRepairIntake(biz,c,{...job,dateIn:dIn,dateOut:dOut,intake:{items:items.map(it=>({...it,clientPrice:itemClient(it)})),instructions}})}>Print / Save PDF</Btn>
      </div>
    </div>
    {trade&&<div style={{background:"#4E8B6A14",border:"1px solid #4E8B6A55",borderRadius:4,padding:"9px 14px",marginBottom:16,fontSize:12.5,color:"#3B6E52",fontWeight:600}}>Trade account — <strong>{Math.round(GST_RATE*100)}% {TAX_LABEL} is added</strong> on top of repair prices.</div>}
    {job.repairToken&&<div style={{background:GOLD_L+"55",border:`1px solid ${GOLD}55`,borderRadius:4,padding:"9px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:12,fontWeight:700,color:GOLD_D,whiteSpace:"nowrap"}}>{ICON_LINK}Client link</span>
      <span style={{flex:1,minWidth:180,fontSize:12,color:WG,wordBreak:"break-all",fontFamily:"monospace"}}>{repairLink}</span>
      {!response&&<><span style={{fontSize:11,fontWeight:700,color:WG,whiteSpace:"nowrap"}}>⏳ Awaiting client response</span>
        <button onClick={()=>fetchResponse(false)} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>{checking?"Checking…":"Check now"}</button></>}
    </div>}
    {response&&(()=>{const acc=response.decision!=="declined";return <div style={{background:(acc?OK:DANGER)+"12",border:`1px solid ${(acc?OK:DANGER)}55`,borderRadius:4,padding:"10px 14px",marginBottom:16,fontSize:13,fontWeight:700,color:acc?OK:DANGER}}>
      {acc?"✓":"✗"} Client {acc?"accepted":"declined"} online{response.name?` — ${response.name}`:""}{response.at?` on ${fmtDate(response.at)}`:""}
    </div>;})()}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
      <div>
        <div style={SS.lbl}>Date taken in</div>
        <input type="date" style={SS.inp} value={dIn} onChange={e=>{setDIn(e.target.value);persistJob({dateIn:e.target.value});}}/>
      </div>
      <div>
        <div style={SS.lbl}>Date of pickup / collection</div>
        <input type="date" style={SS.inp} value={dOut} onChange={e=>{setDOut(e.target.value);persistJob({dateOut:e.target.value});}}/>
      </div>
    </div>

    {/* Items — one per piece brought in */}
    {items.map((it,idx)=>(
      <div key={it.id} style={{border:`1px solid ${BD}`,borderRadius:4,padding:"14px 16px",marginBottom:12,background:PARCH}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:GOLD_D,textTransform:"uppercase",letterSpacing:"0.06em"}}>Item {idx+1}</div>
          {items.length>1&&<div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>moveItem(it.id,-1)} disabled={idx===0} title="Move up" style={{background:"none",border:`1px solid ${BD}`,borderRadius:5,padding:"2px 7px",cursor:idx===0?"not-allowed":"pointer",color:idx===0?BD:WG,fontSize:12,fontFamily:"inherit",lineHeight:1}}>↑</button>
            <button onClick={()=>moveItem(it.id,1)} disabled={idx===items.length-1} title="Move down" style={{background:"none",border:`1px solid ${BD}`,borderRadius:5,padding:"2px 7px",cursor:idx===items.length-1?"not-allowed":"pointer",color:idx===items.length-1?BD:WG,fontSize:12,fontFamily:"inherit",lineHeight:1}}>↓</button>
            <button onClick={()=>removeItem(it.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:12,fontWeight:700,fontFamily:"inherit"}}>× Remove</button>
          </div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 220px",gap:12,marginBottom:12}}>
          <div>
            <div style={{...SS.lbl,height:isMobile?"auto":26,display:"flex",alignItems:"center",marginBottom:4}}>Item type</div>
            <input style={{...SS.inp,marginTop:0}} value={it.itemType} placeholder="e.g. Gold ring, silver bracelet…" onChange={e=>setItemField(it.id,"itemType",e.target.value)} onBlur={commit}/>
          </div>
          <div>
            <div style={{display:"flex",gap:4,marginBottom:4,height:26}}>
              {/* Trade accounts price repairs from set prices only — the cost+markup mode is hidden
                  so the trade GST rule (price + 10%) is never confused with a stacked markup. */}
              {(trade?[["set","Set price"]]:[["set","Set price"],["cost","Cost + markup"]]).map(([m,lbl])=>{
                const on=trade?m==="set":it.priceMode===m;
                return <button key={m} onClick={()=>{setItemField(it.id,"priceMode",m);setTimeout(commit,0);}}
                  style={{flex:1,padding:"0 6px",borderRadius:6,border:`1px solid ${on?INK:BD}`,background:on?INK:"transparent",color:on?WHITE:WG,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>{lbl}</button>;
              })}
              <button onClick={()=>{setPricingFor(it.id);setRpSearch("");}}
                style={{padding:"0 8px",borderRadius:6,border:`1px solid ${BD}`,background:"transparent",color:WG,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",justifyContent:"center"}} title="Look up repair price">📋</button>
            </div>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
              <input type="number" min="0" step="0.01" style={{...SS.inp,marginTop:0,padding:"11px 10px 11px 22px",textAlign:"right",fontWeight:Number(it.price)>0?700:400}} value={it.price} placeholder={(!trade&&it.priceMode==="cost")?"Trade cost":"0.00"} onChange={e=>setItemField(it.id,"price",e.target.value)} onBlur={commit}/>
            </div>
            <div style={{fontSize:10,color:WG,marginTop:4,textAlign:"right",lineHeight:1.4}}>
              {(!trade&&it.priceMode==="cost")
                ?(Number(it.price)>0
                    ?(itemMult(it)?<>×{itemMult(it)} markup → <strong style={{color:OK}}>{fmt(itemClient(it))}</strong> inc {TAX_LABEL}</>:<span style={{color:WARN}}>cost outside markup table</span>)
                    :"Trade cost — manufacturing markup applied")
                :(trade&&Number(it.price)>0
                    ?<>+ {Math.round(GST_RATE*100)}% {TAX_LABEL} → <strong style={{color:OK}}>{fmt(itemClient(it))}</strong> inc {TAX_LABEL}</>
                    :`Final price (inc ${TAX_LABEL})`)}
            </div>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={SS.lbl}>Description of damage / issue</div>
          <textarea style={{...SS.inp,minHeight:64,resize:"vertical"}} value={it.damage} placeholder="Describe the damage or work required…" onChange={e=>setItemField(it.id,"damage",e.target.value)} onBlur={commit}/>
        </div>
        <div>
          <div style={SS.lbl}>Condition on arrival</div>
          <textarea style={{...SS.inp,minHeight:52,resize:"vertical"}} value={it.condition} placeholder="Scratches, missing stones, broken clasp…" onChange={e=>setItemField(it.id,"condition",e.target.value)} onBlur={commit}/>
        </div>
      </div>
    ))}
    <button onClick={addItem} style={{background:"none",border:`1px dashed ${GOLD}`,borderRadius:4,padding:"8px 16px",color:GOLD_D,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:16}}>+ Add another item</button>

    {/* Gold trade-in credit — customer's own metal offsets the repair (a credit, like on quotes) */}
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"210px 1fr",gap:12,alignItems:"end",marginBottom:16,padding:"12px 14px",border:`1px solid ${BD}`,borderRadius:4,background:PARCH}}>
      <div>
        <div style={SS.lbl}>{`Gold trade-in credit (${CUR_SYM})`}</div>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
          <input type="number" min="0" step="0.01" style={{...SS.inp,marginTop:0,padding:"11px 10px 11px 22px",textAlign:"right",fontWeight:Number(tradeIn)>0?700:400}} value={tradeIn} placeholder="0.00" onChange={e=>setTradeIn(e.target.value)} onBlur={commitTradeIn}/>
        </div>
      </div>
      <div>
        <div style={SS.lbl}>Trade-in note <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></div>
        <input style={{...SS.inp,marginTop:0}} value={tradeInNote} placeholder="e.g. old 9ct band, 3.2g" onChange={e=>setTradeInNote(e.target.value)} onBlur={commitTradeIn}/>
      </div>
    </div>

    {/* Repair total */}
    {repairTotal>0&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",background:INK,borderRadius:4,padding:"14px 18px",marginBottom:16}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Repair total{items.filter(i=>Number(i.price)>0).length>1?` · ${items.filter(i=>Number(i.price)>0).length} items`:""}</div>
        {Number(tradeIn)>0
          ?<>
            <div style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.85)",marginTop:2}}>{fmt(repairTotal)} <span style={{fontSize:11,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>inc {TAX_LABEL}</span></div>
            <div style={{fontSize:12,color:"#8FD3AE",marginTop:2}}>less gold trade-in − {fmt(Number(tradeIn))}</div>
            <div style={{fontSize:22,fontWeight:800,color:WHITE,marginTop:2}}>{fmt(Math.max(0,repairTotal-Number(tradeIn)))} <span style={{fontSize:12,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>due</span></div>
          </>
          :<div style={{fontSize:22,fontWeight:800,color:WHITE,marginTop:2}}>{fmt(repairTotal)} <span style={{fontSize:12,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>inc {TAX_LABEL}</span></div>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={setAsCharge} style={{background:"none",border:"1px solid rgba(255,255,255,0.4)",borderRadius:4,padding:"9px 16px",color:WHITE,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Set as job charge</button>
        <button onClick={createRepairInvoice} style={{background:GOLD,border:"none",borderRadius:4,padding:"9px 16px",color:WHITE,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Invoice this repair →</button>
      </div>
    </div>}

    <div style={{marginBottom:16}}>
      <div style={SS.lbl}>Client instructions <span style={{fontWeight:400,color:WG}}>(optional — applies to the whole drop-off)</span></div>
      <textarea style={{...SS.inp,minHeight:56,resize:"vertical"}} value={instructions} placeholder="Any specific requests from the client…" onChange={e=>setInstructions(e.target.value)} onBlur={commit}/>
    </div>
    <div style={{fontSize:12,color:WG,lineHeight:1.7,padding:"12px 14px",background:PARCH,borderRadius:4,border:`1px solid ${BD}`}}>
      <strong style={{color:INK}}>Disclaimer: </strong>We are not responsible for damage to client-supplied gemstones during repair. We do not provide a warranty on repaired pieces — all repairs are undertaken at the client's risk.
    </div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,marginTop:16}}>
      <span style={{fontSize:12,color:WG,fontStyle:"italic"}}>Your changes save automatically.</span>
      <Btn onClick={saveNow}>{saved?"✓ Saved":"Save intake"}</Btn>
    </div>

    {/* Repair pricing lookup panel */}
    {pricingFor&&<div style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.55)",zIndex:200,display:"flex",justifyContent:"flex-end"}} onClick={()=>{setPricingFor(null);setRpSearch("");}}>
      <div style={{width:"100%",maxWidth:420,background:WHITE,height:"100%",display:"flex",flexDirection:"column",boxShadow:"-4px 0 32px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{padding:"18px 20px 12px",borderBottom:`1px solid ${BD}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:800,fontSize:15,color:INK}}>Repair price lookup</div>
            <button onClick={()=>{setPricingFor(null);setRpSearch("");}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:WG,lineHeight:1,padding:0}}>×</button>
          </div>
          <input autoFocus value={rpSearch} onChange={e=>setRpSearch(e.target.value)} placeholder="Search repairs…" style={{...SS.inp,marginTop:0,fontSize:13}}/>
          <div style={{fontSize:11,color:WG,marginTop:7}}>Tap a price to fill it in — or close to enter manually.</div>
        </div>
        {/* Items list */}
        <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {(()=>{
            let lastGroup=null;let lastSubgroup=null;
            return rpFiltered.map(item=>{
              const showGroup=!rpSearch.trim()&&item.group&&item.group!==lastGroup;
              if(showGroup){lastGroup=item.group;lastSubgroup=null;}
              const showSub=!rpSearch.trim()&&item.subgroup&&item.subgroup!==lastSubgroup;
              if(showSub)lastSubgroup=item.subgroup;
              const els=[];
              if(showGroup)els.push(<div key={item.id+"_g"} style={{padding:"10px 20px 4px",background:PARCH,borderTop:`1px solid ${BD}`,borderBottom:`1px solid ${BD}`}}><span style={{fontSize:10,fontWeight:800,color:GOLD_D,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.group}</span></div>);
              if(showSub)els.push(<div key={item.id+"_sg"} style={{padding:"6px 20px 2px"}}><span style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.07em"}}>{item.subgroup}</span></div>);
              els.push(
                <div key={item.id} onClick={()=>pickRepairPrice(item)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 20px",borderBottom:`1px solid ${BD}`,cursor:item.poa?"default":"pointer",background:"transparent",transition:"background 0.1s"}}
                  onMouseEnter={e=>{if(!item.poa)e.currentTarget.style.background=GOLD_L;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                  <span style={{fontSize:13,color:INK,fontWeight:500,paddingRight:12}}>{item.name}</span>
                  {item.poa
                    ?<span style={{fontSize:10,fontWeight:700,color:"#96627C",background:"rgba(150,98,124,0.12)",border:"1px solid rgba(150,98,124,0.3)",borderRadius:4,padding:"2px 7px",whiteSpace:"nowrap"}}>MANUAL QUOTE</span>
                    :<span style={{fontSize:13,fontWeight:700,color:OK,whiteSpace:"nowrap"}}>{fmt(item.baseCost)}</span>}
                </div>
              );
              return els;
            });
          })()}
          {rpFiltered.length===0&&<div style={{padding:"32px 20px",textAlign:"center",color:WG,fontSize:13}}>No repair items match your search.</div>}
        </div>
      </div>
    </div>}
  </Card>;
}

function JobDetail({jobId,jobs,setJobs,clients,setClients,quotes,setQuotes,payments,setPayments,notes,setNotes,invoices,setInvoices,proposals,setProposals,biz,markupTable,pricing=[],setView}){
  const isMobile=useIsMobile();
  const job=jobs.find(j=>j.id===jobId);
  if(!job)return null;
  const c=clients.find(x=>x.id===job.clientId);
  const jq=quotes.filter(q=>q.jobId===jobId);
  const jp=payments.filter(p=>p.jobId===jobId);
  // Trade accounts can invoice a job straight from its quote — no separate "approve" step (the PO /
  // standing account is the authorization). Invoicing auto-approves the quote so every downstream
  // total (job charge, dashboard, statement) still keys off Approved and reconciles. Retail unchanged.
  const isTrade=c?.accountType==="trade";
  // Promote the given quote ids to Approved as part of invoicing (no-op for already-approved retail quotes).
  const approveForInvoice=ids=>setQuotes(p=>{const s=new Set(ids);const n=p.map(q=>s.has(q.id)&&q.status!=="Approved"?{...q,status:"Approved"}:q);persist(K.qu,n);return n;});
  const ji=invoices.filter(i=>i.jobId===jobId);
  const paidTotal=jp.filter(p=>p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const usingOverride=Number(job.totalOverride)>0;
  const jobTotal=jobChargeTotal(job,quotes,markupTable,invoices);
  const jobTradeIn=jobTradeInCredit(job,quotes);            // gold trade-in credit received
  const balance=jobTotal-paidTotal-jobTradeIn;
  const[editStage,setEditStage]=useState(false);
  const[editJobModal,setEditJobModal]=useState(false);
  const[payModal,setPayModal]=useState(false);
  const[combineModal,setCombineModal]=useState(false);
  const[combineSel,setCombineSel]=useState([]);   // approved quote ids to combine into one invoice
  const moveStage=s=>{setJobs(p=>{const n=p.map(j=>j.id===jobId?{...j,stage:s}:j);persist(K.jo,n);return n;});setEditStage(false);};
  // "Awaiting client" park toggle — a manual flag (orthogonal to stage) that drops the job out of
  // the dashboard's active tracking until the client responds. parkedAt is kept for reference.
  const togglePark=()=>{setJobs(p=>{const n=p.map(j=>j.id===jobId?{...j,parked:!j.parked,parkedAt:j.parked?null:today()}:j);persist(K.jo,n);return n;});};
  // Keep any live invoice/proposal link(s) for this job in sync after a payment change, so the
  // customer's link shows the updated Paid / Balance due instead of a stale snapshot.
  const refreshLinks=async(pmts)=>{
    if(!supabaseEnabled||!supabase)return;
    ji.filter(iv=>iv.publicToken).forEach(iv=>{
      const snap=buildInvoiceSnapshot({inv:iv,job,client:c,biz,payments:pmts});
      supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",iv.publicToken).then(()=>{}).catch(()=>{});
    });
    const livePr=(proposals||[]).filter(pr=>pr.jobId===jobId&&pr.token&&pr.status!=="accepted");
    if(!livePr.length)return;
    const photoMap=await jobImageMap(job);
    livePr.forEach(pr=>{
      const snap=buildProposalSnapshot({proposal:pr,job,client:c,biz,quotes,markupTable,payments:pmts,photoMap});
      supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",pr.token).then(()=>{}).catch(()=>{});
    });
  };
  // Duplicate a quote as a fresh Draft on the same job, then open it in the editor.
  const duplicateQuote=q=>{const dup=duplicateQuoteObj(q);setQuotes(p=>{const n=[...p,dup];persist(K.qu,n);return n;});setView("editQuote_"+dup.id);};
  // Reorder a quote within this job (dir -1 = up, +1 = down). This order drives how options
  // appear on new proposals, so the user can control the proposal layout from here.
  const moveQuote=(id,dir)=>setQuotes(prev=>{
    const order=prev.filter(q=>q.jobId===jobId).map(q=>q.id);
    const i=order.indexOf(id),j=i+dir;
    if(i<0||j<0||j>=order.length)return prev;
    const ia=prev.findIndex(q=>q.id===id),ib=prev.findIndex(q=>q.id===order[j]);
    const n=[...prev];[n[ia],n[ib]]=[n[ib],n[ia]];
    persist(K.qu,n);return n;
  });
  const addPay=f=>{if(!guardEdit())return;const n=[...payments,{...f,id:uid(),jobId,date:f.date||today()}];setPayments(n);persist(K.pa,n);refreshLinks(n);setPayModal(false);};
  const delPay=id=>{if(!confirm("Delete this payment?"))return;const n=payments.filter(x=>x.id!==id);setPayments(n);persist(K.pa,n);refreshLinks(n);};
  const delJob=()=>{
    if(!confirm("Delete this job? This will also remove all related quotes, payments, notes and invoices."))return;
    setJobs(p=>{const n=p.filter(j=>j.id!==jobId);persist(K.jo,n);return n;});
    setQuotes(p=>{const n=p.filter(q=>q.jobId!==jobId);persist(K.qu,n);return n;});
    setPayments(p=>{const n=p.filter(x=>x.jobId!==jobId);persist(K.pa,n);return n;});
    setNotes(p=>{const n=p.filter(x=>x.jobId!==jobId);persist(K.no,n);return n;});
    setInvoices(p=>{const n=p.filter(x=>x.jobId!==jobId);persist(K.inv,n);return n;});
    setView("jobs");
  };
  const createInvoice=qid=>{
    if(!guardEdit())return;
    const q=quotes.find(x=>x.id===qid);if(!q)return;
    approveForInvoice([qid]);   // trade: skip the manual approve step; keeps invoiced quotes Approved
    // GST-inclusive model: the quoted price already includes GST (helper backs out the GST component).
    const content=invoiceContentFromQuote(q,job,markupTable);
    const inv={id:uid(),jobId,quoteId:qid,quoteIds:[qid],number:nextInvoiceNumber(invoices,biz),date:today(),status:"Unpaid",notes:q.notes||"",...content};
    setInvoices(p=>{const n=[...p,inv];persist(K.inv,n);return n;});
    declineOrphanApprovedQuotes(jobId,[qid],quotes,invoices,setQuotes,markupTable);
    setView("invoiceDetail_"+inv.id);
  };
  // Quotes on this job that can be invoiced: approved (retail) or any not-yet-invoiced quote for a
  // trade account (trade skips the approve step). Invoicing auto-approves them.
  const invoiceableUninvoiced=jq.filter(q=>(q.status==="Approved"||isTrade)&&!quoteHasInvoice(invoices,q.id));
  const openCombine=()=>{setCombineSel(invoiceableUninvoiced.map(q=>q.id));setCombineModal(true);};
  const toggleCombine=id=>setCombineSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const combineTotal=combineSel.reduce((s,id)=>{const q=jq.find(x=>x.id===id);return s+(q?quoteGrandTotal(q,markupTable):0);},0);
  const createCombinedInvoice=()=>{
    if(!guardEdit())return;
    const qs=combineSel.map(id=>jq.find(x=>x.id===id)).filter(Boolean);
    if(!qs.length)return;
    approveForInvoice(qs.map(q=>q.id));   // trade: promote to Approved so job/statement totals reconcile
    const inv=buildCombinedInvoice(qs,job,invoices,markupTable,biz);
    setInvoices(p=>{const n=[...p,inv];persist(K.inv,n);return n;});
    declineOrphanApprovedQuotes(jobId,qs.map(q=>q.id),quotes,invoices,setQuotes,markupTable);
    setCombineModal(false);
    setView("invoiceDetail_"+inv.id);
  };
  return <div>
    <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"flex-start",gap:isMobile?14:10,marginBottom:20}}>
      <div style={{minWidth:0}}><h1 style={{margin:0,fontSize:isMobile?20:24,fontWeight:800,color:INK,letterSpacing:"-0.02em",wordBreak:"break-word"}}>{job.type}</h1>
      <div style={{color:WG,fontSize:13,marginTop:3}}>{clientDisplayName(c)}{job.deadline?` · Due ${fmtDate(job.deadline)}`:""}</div>
      {(job.dateIn||job.dateOut)&&<div style={{fontSize:12,color:WG,marginTop:2}}>Taken in: <b style={{color:INK}}>{job.dateIn?fmtDate(job.dateIn):"—"}</b> · Pickup: <b style={{color:INK}}>{job.dateOut?fmtDate(job.dateOut):"—"}</b></div>}
      {job.supplier&&<div style={{fontSize:12,color:WG,marginTop:2}}>Supplier: {job.supplier}{job.supplierRef?` · ${job.supplierRef}`:""}</div>}</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
        <Badge label={job.stage} color={SC[job.stage]||WG} size="lg"/>
        {job.parked&&<Badge label="Awaiting client" color={WARN} size="lg"/>}
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>setEditStage(v=>!v)}>Move stage</Btn>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={togglePark}>{job.parked?"↩ Reactivate":"⏸ Awaiting client"}</Btn>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>printJobDocket(biz,c,job,jq)}>🏷 Docket</Btn>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>printJobLabels(biz,c,job,jq)}>Labels</Btn>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>printJobLabel(biz,c,job)}>Tag</Btn>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>setEditJobModal(true)}>Edit job</Btn>
        <Btn sm={!isMobile} xs={isMobile} danger onClick={delJob}>Delete job</Btn>
      </div>
    </div>
    {job.stage==="Ready for collection"&&<ReadyForCollectionCard job={job} client={c} biz={biz} setJobs={setJobs} setClients={setClients}/>}
    {editStage&&<Card style={{background:PARCH}}>
      <div style={{...SS.lbl,marginBottom:10}}>Move to stage</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {JOB_STAGES.map(s=><button key={s} onClick={()=>moveStage(s)} style={{padding:"4px 11px",borderRadius:3,border:`1px solid ${job.stage===s?SC[s]:BD}`,background:job.stage===s?(SC[s]+"22"):"transparent",color:job.stage===s?SC[s]:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{s}</button>)}
      </div>
    </Card>}
    {job.description&&<Card><div style={{...SS.lbl,marginBottom:8}}>Description</div><div style={{fontSize:14,color:INK,lineHeight:1.7}}>{job.description}</div>{job.notes&&<div style={{marginTop:10,fontSize:13,color:WG,fontStyle:"italic",borderTop:`1px solid ${BD}`,paddingTop:10}}>Notes: {job.notes}</div>}</Card>}
    {job.type==="Repair"&&<RepairIntakeCard job={job} setJobs={setJobs} biz={biz} clients={clients} markupTable={markupTable} pricing={pricing} invoices={invoices} setInvoices={setInvoices} setView={setView}/>}
    <JobImages job={job} setJobs={setJobs}/>
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,color:INK}}>Payments</div>
        <Btn sm onClick={()=>setPayModal(true)}>+ Record payment</Btn>
      </div>
      {jobTotal>0&&(()=>{
        const totalReceived=paidTotal+jobTradeIn;   // gold trade-in counts as value received
        const stats=[
          [usingOverride?"Total charge":"Approx. quote",fmt(jobTotal),INK,null],
          ["Received",fmt(totalReceived),OK,jobTradeIn>0?`${fmt(paidTotal)} paid · ${fmt(jobTradeIn)} gold trade-in`:null],
          ["Outstanding",fmt(Math.max(0,balance)),balance>0.5?WARN:OK,null],
        ];
        return <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(${stats.length},1fr)`,gap:10,marginBottom:14}}>
          {stats.map(([l,v,col,sub])=>(
            <div key={l} style={{background:PARCH,borderRadius:4,padding:"10px 12px",border:`1px solid ${BD}`}}>
              <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</div>
              <div style={{fontSize:19,fontWeight:800,color:col,marginTop:3}}>{v}</div>
              {sub&&<div style={{fontSize:10,color:WG,marginTop:3,lineHeight:1.35}}>{sub}</div>}
            </div>
          ))}
        </div>;
      })()}
      {jp.length===0&&<div style={{color:WG,fontSize:14}}>No payments yet.</div>}
      {jp.map(p=>(
        <div key={p.id} style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"center",gap:isMobile?6:0,padding:"9px 0",borderBottom:`1px solid ${BD}`}}>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13,color:INK}}>{p.type}</div><div style={{fontSize:12,color:WG,marginTop:1}}>{fmtDate(p.date)} · {p.method}{p.notes?` · ${p.notes}`:""}</div></div>
          <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:isMobile?"flex-start":"flex-end",flexShrink:0}}>
            <Badge label={p.status} color={p.status==="Received"?OK:WARN}/>
            <div style={{fontWeight:800,fontSize:14,color:INK,minWidth:76,textAlign:isMobile?"left":"right"}}>{fmt(p.amount)}</div>
            <button onClick={()=>delPay(p.id)} title="Delete payment" style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,marginLeft:isMobile?"auto":0}}>×</button>
          </div>
        </div>
      ))}
    </Card>
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Invoices ({ji.length})</div>
      {ji.length===0&&<div style={{color:WG,fontSize:14}}>No invoices yet. Create one from an approved quote below.</div>}
      {ji.map(inv=>{
        const es=invoiceEffectiveStatus(inv,payments,invoices);
        return <div key={inv.id} onClick={()=>setView("invoiceDetail_"+inv.id)} style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"center",gap:isMobile?6:0,padding:"9px 0",borderBottom:`1px solid ${BD}`,cursor:"pointer"}}>
          <div style={{minWidth:0}}><div style={{fontWeight:600,fontSize:14,color:INK}}>{inv.number}</div><div style={{fontSize:12,color:WG,marginTop:1}}>{fmtDate(inv.date)}</div></div>
          <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:isMobile?"space-between":"flex-end",flexShrink:0}}>
            <Badge label={es} color={es==="Paid"?OK:es==="Overdue"?DANGER:WARN}/>
            <div style={{fontWeight:800,fontSize:14,color:INK}}>{fmt(inv.totalIncGST)} <span style={{fontSize:11,color:WG,fontWeight:400}}>inc {TAX_LABEL}</span></div>
          </div>
        </div>;
      })}
    </Card>
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,color:INK}}>Quotes ({jq.length})</div>
        <div style={{display:"flex",gap:8}}>
          {invoiceableUninvoiced.length>=2&&<Btn sm onClick={openCombine}>→ Combine into invoice</Btn>}
          <Btn sm onClick={()=>setView("newQuote_"+jobId)}>+ New quote</Btn>
        </div>
      </div>
      {jq.length===0&&<div style={{color:WG,fontSize:14}}>No quotes yet.</div>}
      {jq.length>1&&<div style={{fontSize:11,color:WG,marginBottom:6}}>Order shown here is the order options appear on new proposals.</div>}
      {jq.map((q,qi)=>{
        const calc=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
        const hasInv=quoteHasInvoice(invoices,q.id);
        const manual=quoteIsManual(q);
        const stoneTotal=(q.stoneClientTotal||0)+(q.accentStoneTotal||0);
        const priceStr=manual?fmtR(Number(q.manualTotal)):(calc.base>0&&!calc.bracket&&!calc.overridden)?"—":fmtR(calc.finalLow+stoneTotal);
        return <div key={q.id} style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"center",gap:isMobile?8:0,padding:"10px 0",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
            {jq.length>1&&<div style={{display:"flex",flexDirection:"column",flexShrink:0}}>
              <button onClick={()=>moveQuote(q.id,-1)} disabled={qi===0} title="Move up" style={{background:"none",border:"none",cursor:qi===0?"default":"pointer",color:qi===0?BD:WG,fontSize:11,lineHeight:1,padding:"1px 3px",fontFamily:"inherit"}}>▲</button>
              <button onClick={()=>moveQuote(q.id,1)} disabled={qi===jq.length-1} title="Move down" style={{background:"none",border:"none",cursor:qi===jq.length-1?"default":"pointer",color:qi===jq.length-1?BD:WG,fontSize:11,lineHeight:1,padding:"1px 3px",fontFamily:"inherit"}}>▼</button>
            </div>}
            <div style={{cursor:"pointer",flex:1,minWidth:0}} onClick={()=>setView("quoteDetail_"+q.id)}>
              <div style={{fontWeight:600,fontSize:14,color:INK}}>{quoteLabel(q)} <span style={{fontWeight:400,color:WG,fontSize:12}}>{q.title?.trim()?quoteRef(q):""}</span></div>
              <div style={{fontSize:12,color:WG,marginTop:1}}>{manual?<>Manual quoted price → </>:<>Base: {fmt(calc.baseLow)} → {calc.mult}× → </>}<strong style={{color:OK}}>{priceStr}</strong></div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
            <Badge label={q.status} color={q.status==="Approved"?OK:q.status==="Draft"?WG:GOLD_D}/>
            <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>duplicateQuote(q)}>⧉ Duplicate</Btn>
            {(q.status==="Approved"||isTrade)&&!hasInv&&<Btn sm={!isMobile} xs={isMobile} onClick={()=>createInvoice(q.id)}>→ Invoice</Btn>}
          </div>
        </div>;
      })}
    </Card>
    <JobProposals job={job} client={c} quotes={jq} proposals={proposals} setProposals={setProposals} setQuotes={setQuotes} biz={biz} markupTable={markupTable} payments={jp} invoices={invoices}/>
    <ActivityLog jobId={jobId} notes={notes} setNotes={setNotes}/>
    {payModal&&<Modal title="Record payment" onClose={()=>setPayModal(false)}>
      <PaymentForm onSave={addPay} onCancel={()=>setPayModal(false)} suggestedAmount={balance>0?balance:""}/>
    </Modal>}
    {combineModal&&<Modal title="Combine quotes into one invoice" onClose={()=>setCombineModal(false)}>
      <div style={{fontSize:13,color:WG,lineHeight:1.6,marginBottom:14}}>Tick the quotes to bill together on a single invoice — each appears as its own line with its price. {isTrade?"Trade account — quotes don't need approving first; invoicing confirms them.":"Only approved quotes without an existing invoice are shown."}</div>
      {invoiceableUninvoiced.map(q=>{
        const on=combineSel.includes(q.id);
        return <label key={q.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1px solid ${on?GOLD:BD}`,borderRadius:6,marginBottom:8,cursor:"pointer",background:on?GOLD_L+"44":WHITE}}>
          <input type="checkbox" checked={on} onChange={()=>toggleCombine(q.id)}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:600,fontSize:14,color:INK}}>{quoteLabel(q)}</div>
            {(q.clientDescription||job.description)&&<div style={{fontSize:12,color:WG}}>{q.clientDescription||job.description}</div>}
          </div>
          <div style={{fontWeight:700,color:OK}}>{fmtR(quoteGrandTotal(q,markupTable))}</div>
        </label>;
      })}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${BD}`,marginTop:6,paddingTop:12}}>
        <span style={{fontSize:12,color:WG}}>Invoice {nextInvoiceNumber(invoices,biz)} · {combineSel.length} quote{combineSel.length!==1?"s":""}{combineSel.length>1?" combined":""}</span>
        <span style={{fontSize:16,fontWeight:800,color:OK}}>{fmtR(combineTotal)} <span style={{fontSize:11,color:WG,fontWeight:400}}>inc {TAX_LABEL}</span></span>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
        <Btn ghost onClick={()=>setCombineModal(false)}>Cancel</Btn>
        <Btn disabled={!combineSel.length} onClick={createCombinedInvoice}>{combineSel.length>1?`Create combined invoice (${combineSel.length})`:"Create invoice"}</Btn>
      </div>
    </Modal>}
    {editJobModal&&<Modal title="Edit job" onClose={()=>setEditJobModal(false)}>
      <JobForm clients={clients} initial={job} onSave={f=>{
        setJobs(p=>{const n=p.map(j=>j.id===jobId?{...j,...f}:j);persist(K.jo,n);return n;});
        setEditJobModal(false);
      }} onCancel={()=>setEditJobModal(false)}/>
    </Modal>}
  </div>;
}

function PaymentForm({onSave,onCancel,suggestedAmount}){
  const[f,setF]=useState({type:PAY_TYPES[0],amount:suggestedAmount||"",date:today(),method:PAY_METHODS[0],notes:"",status:"Received"});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const TRADEIN="Gold/Silver trade in";
  const isTradeIn=f.method===TRADEIN;
  // Choosing the trade-in method auto-sets the stage to "Trade-in credit" (no stage choice needed);
  // switching away from it resets the stage so it isn't left on "Trade-in credit".
  const setMethod=v=>setF(p=>({...p,method:v,type:v===TRADEIN?"Trade-in credit":(p.type==="Trade-in credit"?PAY_TYPES[0]:p.type)}));
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      {isTradeIn
        ?<div style={{marginBottom:14}}><label style={SS.lbl}>Recording</label><div style={{...SS.inp,background:PARCH,color:GOLD_D,fontWeight:700,display:"flex",alignItems:"center"}}>Trade-in credit</div></div>
        :<Input label="Payment stage" value={f.type} onChange={set("type")} as="select" options={PAY_TYPES.filter(t=>t!=="Trade-in credit")}/>}
      <Input label={`Amount (${CUR_SYM})`} value={f.amount} onChange={set("amount")} type="number" min="0" step="0.01"/>
      <Input label="Date" value={f.date} onChange={set("date")} type="date"/>
      <Input label="Method" value={f.method} onChange={setMethod} as="select" options={PAY_METHODS}/>
    </div>
    <div style={{borderTop:`1px solid ${BD}`,margin:"6px 0 16px"}}/>
    <Input label="Notes" value={f.notes} onChange={set("notes")} placeholder="e.g. deposit to begin design phase"/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn ghost onClick={onCancel}>Cancel</Btn>
      <Btn onClick={()=>{if(!f.amount)return alert("Enter an amount");onSave(f);}}>Save payment</Btn>
    </div>
  </div>;
}

// ── Quote Builder ─────────────────────────────────────────────────────────
// ── Accent Stone Modal ────────────────────────────────────────────────────
const STONE_SHAPES=["Round","Marquise","Pear","Oval","Princess","Emerald","Cushion","Baguette","Trillion","Asscher","Radiant","Heart","Other"];
const STONE_COLOURS=["Blue","Pink","Yellow","Green","Purple","Orange","Red","Teal","White / Colourless","Champagne","Black","Grey","Padparadscha","Bi-colour","Other"];
// White-diamond colour grading (D = colourless → M = faint), plus common melee ranges + fancy.
const DIAMOND_COLOURS=[{value:"D",label:"D — Colourless"},{value:"E",label:"E — Colourless"},{value:"F",label:"F — Colourless"},{value:"G",label:"G — Near colourless"},{value:"H",label:"H — Near colourless"},{value:"I",label:"I — Near colourless"},{value:"J",label:"J — Near colourless"},{value:"K",label:"K — Faint"},{value:"L",label:"L — Faint"},{value:"M",label:"M — Faint"},{value:"D-F",label:"D–F (melee range)"},{value:"G-H",label:"G–H (melee range)"},{value:"I-J",label:"I–J (melee range)"},{value:"Fancy",label:"Fancy colour"}];
// White-diamond clarity grading (FL best → I3), plus common melee ranges.
const DIAMOND_CLARITY=[{value:"FL",label:"FL — Flawless"},{value:"IF",label:"IF — Internally flawless"},{value:"VVS1",label:"VVS1 — Very very slightly incl."},{value:"VVS2",label:"VVS2 — Very very slightly incl."},{value:"VS1",label:"VS1 — Very slightly incl."},{value:"VS2",label:"VS2 — Very slightly incl."},{value:"SI1",label:"SI1 — Slightly incl."},{value:"SI2",label:"SI2 — Slightly incl."},{value:"I1",label:"I1 — Included"},{value:"I2",label:"I2 — Included"},{value:"I3",label:"I3 — Included"},{value:"VVS",label:"VVS (melee range)"},{value:"VS",label:"VS (melee range)"},{value:"SI",label:"SI (melee range)"},{value:"VS-SI",label:"VS–SI (melee range)"}];
// Fancy coloured-diamond grading: intensity/saturation + hue (e.g. "Fancy Vivid Yellow").
const FANCY_INTENSITY=["Faint","Very Light","Light","Fancy Light","Fancy","Fancy Dark","Fancy Deep","Fancy Intense","Fancy Vivid"];
const FANCY_HUES=["Yellow","Pink","Blue","Green","Orange","Red","Purple","Violet","Brown","Champagne","Cognac","Grey","Black","Olive","Other"];
function AccentStoneModal({pricing,setPricing,naturalStoneMarkup,labStoneMarkup,onAdd,onClose}){
  // Quick structured fancy / cut stone entry
  const[type,setType]=useState("");
  const[colour,setColour]=useState("");
  const[clarity,setClarity]=useState("");
  const[fancyIntensity,setFancyIntensity]=useState("");
  const[fancyHue,setFancyHue]=useState("");
  const[shape,setShape]=useState("Round");
  const[carat,setCarat]=useState("");
  const[size,setSize]=useState("");
  const[qty,setQty]=useState("");
  const[cost,setCost]=useState("");
  const[costMode,setCostMode]=useState("total");  // "total" = one figure | "perCt" = carat weight × $/ct (melee parcels)
  const[perCt,setPerCt]=useState("");
  const[qMarkup,setQMarkup]=useState("mfg");
  const qn=Math.max(1,Number(qty)||1);            // descriptive count (defaults to 1)
  const caratN=Number(carat)||0;
  const perCtN=Number(perCt)||0;
  const perCtMode=costMode==="perCt";
  // TOTAL cost for the stone(s): entered directly, or calculated as carat weight × per-carat rate
  const cn=perCtMode?+(caratN*perCtN).toFixed(2):Number(cost)||0;
  const canAdd=cn>0;
  const isDiamond=type==="Diamond";
  const pickType=v=>{setType(v);setColour("");setClarity("");};   // diamonds use colour/clarity grades, other stones use hues
  const colourOpts=isDiamond
    ?[{value:"",label:"— Select grade —"},...DIAMOND_COLOURS]
    :[{value:"",label:"— None —"},...STONE_COLOURS.map(c=>({value:c,label:c}))];
  const colourPart=!colour?""
    :isDiamond
      ?(colour==="Fancy"?[fancyIntensity,fancyHue].filter(Boolean).join(" "):`${colour} colour`)
      :colour;
  const clarityPart=isDiamond&&clarity?`${clarity} clarity`:"";
  const quickParts=[colourPart,clarityPart,type,carat?`${carat}ct${perCtMode&&qn>1?" total":""}`:"",shape,size].filter(Boolean).join(" ");
  const quickDesc=`${qn>1?qn+" × ":""}${quickParts}`.trim();
  // When priced on the stone (natural/lab) markup, show the resulting client price
  const stoneMU=qMarkup==="natural"||qMarkup==="lab";
  const stonePreview=stoneMU&&cn>0?calcStoneQuote([{cost:cn}],qMarkup==="lab"?labStoneMarkup:naturalStoneMarkup):null;
  const addQuick=()=>{
    if(cn<=0)return alert(perCtMode?"Enter the carat weight and price per carat.":"Enter the cost.");
    // Per-carat parcels carry their working in the detail column so the cost stays traceable.
    const detail=perCtMode?`${caratN}ct × ${fmt(perCtN)}/ct`:"";
    onAdd({description:quickDesc,detail,costLow:cn.toFixed(2),markupMode:qMarkup});
  };
  return <Modal title="Add accent, feature or fancy stone" onClose={onClose}>
      {/* Quick structured cut/fancy stone entry */}
      <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"20px 22px"}}>
        <div style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Quick add</div>
        <div style={{fontSize:12,color:WG,marginBottom:18,lineHeight:1.5}}>For a coloured or fancy-cut stone that isn't in your pricing database.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Input label="Stone type" value={type} onChange={pickType} as="select" options={[{value:"",label:"— Select stone —"},...GEM_TYPES.map(t=>({value:t,label:t}))]}/>
          <Input label={isDiamond?"Colour grade":"Colour"} value={colour} onChange={setColour} as="select" options={colourOpts}/>
          {isDiamond&&colour==="Fancy"&&<div style={{gridColumn:"1 / -1",marginBottom:14,padding:"14px 16px",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS}}>
            <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Fancy colour grading</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              <Input label="Intensity" value={fancyIntensity} onChange={setFancyIntensity} as="select" options={[{value:"",label:"— Select —"},...FANCY_INTENSITY.map(x=>({value:x,label:x}))]}/>
              <Input label="Hue" value={fancyHue} onChange={setFancyHue} as="select" options={[{value:"",label:"— Select —"},...FANCY_HUES.map(x=>({value:x,label:x}))]}/>
            </div>
          </div>}
          {isDiamond&&<Input label="Clarity" value={clarity} onChange={setClarity} as="select" options={[{value:"",label:"— Select clarity —"},...DIAMOND_CLARITY]}/>}
          <Input label="Cut / shape" value={shape} onChange={setShape} as="select" options={STONE_SHAPES}/>
          <Input label={perCtMode?"Total carat weight (ct)":"Carat weight"} value={carat} onChange={setCarat} type="number" min="0" step="0.01" placeholder={perCtMode?"e.g. 0.85":"e.g. 0.50"}/>
          <Input label="Size / dimensions" value={size} onChange={setSize} placeholder="e.g. 4×2mm"/>
          <Input label="Quantity" value={qty} onChange={setQty} type="number" min="1" placeholder="1"/>
          <div style={{gridColumn:"1 / -1"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
              <label style={SS.lbl}>Cost</label>
              <div style={{display:"inline-flex",border:`1px solid ${BD}`,borderRadius:3,overflow:"hidden"}}>
                {[["total","Total cost"],["perCt","Per carat"]].map(([k,lbl])=>(
                  <button key={k} onClick={()=>setCostMode(k)} style={{padding:"4px 12px",border:"none",background:costMode===k?INK:WHITE,color:costMode===k?WHITE:INK,fontSize:10.5,fontWeight:700,letterSpacing:"0.04em",cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
                ))}
              </div>
            </div>
            {perCtMode
              ?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
                <Input label={`Price per carat (${CUR_SYM}/ct)`} value={perCt} onChange={setPerCt} type="number" min="0" step="0.01" placeholder="e.g. 500"/>
                <div style={{marginBottom:14}}>
                  <label style={SS.lbl}>Calculated total</label>
                  <div style={{...SS.inp,background:PARCH,fontWeight:cn>0?700:400,color:cn>0?INK:WG,textAlign:"right"}}>
                    {cn>0?fmt(cn):(caratN<=0&&perCtN>0?"Enter the total carat weight above":"—")}
                  </div>
                </div>
              </div>
              :<Input label={`Total cost (${CUR_SYM})`} value={cost} onChange={setCost} type="number" min="0" step="0.01" placeholder="0.00"/>}
          </div>
        </div>
        <div style={{fontSize:11,color:WG,marginTop:2,lineHeight:1.5,fontStyle:"italic"}}>
          {perCtMode
            ?<>Ideal for melee parcels — cost = total carat weight × price per carat. Type, colour, cut, size &amp; quantity are for the description only.</>
            :<>Type, colour, cut, carat, size &amp; quantity describe the stone — they don't affect the price. Cost is the total you paid.</>}
        </div>

        <div style={{height:1,background:BD,margin:"18px 0"}}/>

        <label style={{...SS.lbl,marginBottom:5}}>Markup</label>
        <div style={{fontSize:11,color:WG,lineHeight:1.5,marginBottom:9}}>Each tier's markup rates are decided in your Settings tab.</div>
        <select value={qMarkup} onChange={e=>setQMarkup(e.target.value)} style={{...SS.inp,marginTop:0,fontSize:13}}>
          <option value="mfg">Manufacturing Markup</option>
          <option value="natural">Natural Diamond/Gemstone Markup</option>
          <option value="lab">Lab-Grown Diamond/Gemstone Markup</option>
        </select>
        {/* Markup hint — when on the stone markup, show the resulting client price */}
        {stoneMU&&<div style={{fontSize:12,marginTop:10,lineHeight:1.5,color:stonePreview?(stonePreview.bracket?"#96627C":WARN):WG}}>
          {stonePreview
            ?(stonePreview.bracket?<>→ <strong>{fmtR(stonePreview.clientTotal)}</strong> to client (×{stonePreview.mult} + {TAX_LABEL})</>:"Cost is outside your stone markup table — check the rates in Pricing DB.")
            :"Priced on the "+(qMarkup==="lab"?"lab-grown":"natural")+" stone markup (cost × tier + "+TAX_LABEL+"). Enter a cost to preview."}
        </div>}
        {!stoneMU&&<div style={{fontSize:12,marginTop:10,lineHeight:1.5,color:WG}}>Priced with the jewellery piece on the manufacturing markup.</div>}

        <div style={{display:"flex",justifyContent:"center",marginTop:20}}>
          <Btn onClick={addQuick} disabled={!canAdd}>Add to quote</Btn>
        </div>
      </div>
  </Modal>;
}

// ── Centre stone modal — structured entry for the sourced centre stone ─────
// Mirrors the accent/fancy modal, adapted for centre stones: no markup choice (always the
// section's Natural/Lab stone markup), plus certificate and diamond-grading fields.
const CERT_LABS=["GIA","IGI","GCAL","HRD","GSL","Other"];
const GRADE_EXVG=[{value:"",label:"— Select —"},{value:"EX",label:"EX — Excellent"},{value:"VG",label:"VG — Very Good"},{value:"G",label:"G — Good"},{value:"F",label:"F — Fair"}];
const FLUORO=["None","Faint","Medium","Strong","Very Strong"];
function CentreStoneModal({stoneType,activeStoneMarkup,stoneOverride,onAdd,onClose}){
  const[type,setType]=useState("Diamond");
  const[certLab,setCertLab]=useState("");
  const[certNo,setCertNo]=useState("");
  const[colour,setColour]=useState("");
  const[fancyIntensity,setFancyIntensity]=useState("");
  const[fancyHue,setFancyHue]=useState("");
  const[clarity,setClarity]=useState("");
  const[shape,setShape]=useState("");
  const[carat,setCarat]=useState("");
  const[size,setSize]=useState("");
  const[cutG,setCutG]=useState("");
  const[polish,setPolish]=useState("");
  const[symmetry,setSymmetry]=useState("");
  const[fluoro,setFluoro]=useState("");
  const[source,setSource]=useState("");
  const[cost,setCost]=useState("");
  const[perCt,setPerCt]=useState("");
  const[costMode,setCostMode]=useState("total");
  const caratN=Number(carat)||0;
  const perCtN=Number(perCt)||0;
  const perCtMode=costMode==="perCt";
  const cn=perCtMode?+(caratN*perCtN).toFixed(2):Number(cost)||0;
  const isDiamond=type==="Diamond";
  const pickType=v=>{setType(v);setColour("");setClarity("");setCutG("");setPolish("");setSymmetry("");setFluoro("");};
  const colourOpts=isDiamond
    ?[{value:"",label:"— Select grade —"},...DIAMOND_COLOURS]
    :[{value:"",label:"— None —"},...STONE_COLOURS.map(c=>({value:c,label:c}))];
  // "GIA Natural Oval 1.50ct D SI1 EX EX None" — the format already used across real quotes.
  const colourPart=!colour?"":isDiamond?(colour==="Fancy"?[fancyIntensity,fancyHue].filter(Boolean).join(" "):colour):colour;
  const gradingPart=isDiamond?[cutG,polish,symmetry].filter(Boolean).join(" "):"";
  const parts=[certLab,stoneType==="lab"?"Lab-Grown":"Natural",shape,carat?`${carat}ct`:"",colourPart,isDiamond?clarity:"",gradingPart,isDiamond?fluoro:"",isDiamond?"":type,size].filter(Boolean).join(" ");
  const desc=parts.trim();
  const detail=[certNo?`Cert ${certNo}`:"",perCtMode&&cn>0?`${caratN}ct × ${fmt(perCtN)}/ct`:"",source.trim()].filter(Boolean).join(" · ");
  // Live client price on the section's stone markup (same maths as the quote's stone section)
  const preview=cn>0?calcStoneQuote([{cost:cn}],activeStoneMarkup,stoneOverride):null;
  const accent=stoneType==="lab"?"#96627C":"#4E8B6A";
  const addStone=()=>{
    if(cn<=0)return alert(perCtMode?"Enter the carat weight and price per carat.":"Enter the cost.");
    onAdd({description:desc||`${stoneType==="lab"?"Lab-grown":"Natural"} centre stone`,detail,cost:cn.toFixed(2)});
  };
  return <Modal title={`Centre Stone — ${stoneType==="lab"?"Lab-Grown":"Natural"} Diamond/Gemstone`} onClose={onClose}>
    <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"20px 22px"}}>
      <div style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Centre / feature stone</div>
      <div style={{fontSize:12,color:WG,marginBottom:18,lineHeight:1.5}}>Builds the stone description for the quote — priced on your <strong style={{color:accent}}>{stoneType==="lab"?"lab-grown":"natural"}</strong> stone markup.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Input label="Stone type" value={type} onChange={pickType} as="select" options={GEM_TYPES.map(t=>({value:t,label:t}))}/>
        <Input label="Cut / shape" value={shape} onChange={setShape} as="select" options={STONE_SHAPES}/>
        <Input label="Certificate" value={certLab} onChange={setCertLab} as="select" options={[{value:"",label:"— None —"},...CERT_LABS.map(l=>({value:l,label:l}))]}/>
        <Input label="Certificate number" value={certNo} onChange={setCertNo} placeholder="e.g. 2141234567"/>
        <Input label={isDiamond?"Colour grade":"Colour"} value={colour} onChange={setColour} as="select" options={colourOpts}/>
        {isDiamond&&<Input label="Clarity" value={clarity} onChange={setClarity} as="select" options={[{value:"",label:"— Select clarity —"},...DIAMOND_CLARITY]}/>}
        {isDiamond&&colour==="Fancy"&&<div style={{gridColumn:"1 / -1",marginBottom:14,padding:"14px 16px",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Fancy colour grading</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Input label="Intensity" value={fancyIntensity} onChange={setFancyIntensity} as="select" options={[{value:"",label:"— Select —"},...FANCY_INTENSITY.map(x=>({value:x,label:x}))]}/>
            <Input label="Hue" value={fancyHue} onChange={setFancyHue} as="select" options={[{value:"",label:"— Select —"},...FANCY_HUES.map(x=>({value:x,label:x}))]}/>
          </div>
        </div>}
        {isDiamond&&<div style={{gridColumn:"1 / -1",marginBottom:14,padding:"14px 16px",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Diamond grading <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional — e.g. EX EX None)</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Input label="Cut" value={cutG} onChange={setCutG} as="select" options={GRADE_EXVG}/>
            <Input label="Polish" value={polish} onChange={setPolish} as="select" options={GRADE_EXVG}/>
            <Input label="Symmetry" value={symmetry} onChange={setSymmetry} as="select" options={GRADE_EXVG}/>
            <Input label="Fluorescence" value={fluoro} onChange={setFluoro} as="select" options={[{value:"",label:"— Select —"},...FLUORO.map(x=>({value:x,label:x}))]}/>
          </div>
        </div>}
        <Input label={perCtMode?"Total carat weight (ct)":"Carat weight"} value={carat} onChange={setCarat} type="number" min="0" step="0.01" placeholder="e.g. 1.50"/>
        <Input label="Size / dimensions" value={size} onChange={setSize} placeholder="e.g. 7.3×5.4mm"/>
        <div style={{gridColumn:"1 / -1"}}>
          <Input label="Source / notes" value={source} onChange={setSource} placeholder="e.g. supplier, memo ref — goes in the detail column"/>
        </div>
        <div style={{gridColumn:"1 / -1"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <label style={SS.lbl}>Cost</label>
            <div style={{display:"inline-flex",border:`1px solid ${BD}`,borderRadius:3,overflow:"hidden"}}>
              {[["total","Total cost"],["perCt","Per carat"]].map(([k,lbl])=>(
                <button key={k} onClick={()=>setCostMode(k)} style={{padding:"4px 12px",border:"none",background:costMode===k?INK:WHITE,color:costMode===k?WHITE:INK,fontSize:10.5,fontWeight:700,letterSpacing:"0.04em",cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
              ))}
            </div>
          </div>
          {perCtMode
            ?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              <Input label={`Price per carat (${CUR_SYM}/ct)`} value={perCt} onChange={setPerCt} type="number" min="0" step="0.01" placeholder="e.g. 4500"/>
              <div style={{marginBottom:14}}>
                <label style={SS.lbl}>Calculated total</label>
                <div style={{...SS.inp,background:PARCH,fontWeight:cn>0?700:400,color:cn>0?INK:WG,textAlign:"right"}}>
                  {cn>0?fmt(cn):(caratN<=0&&perCtN>0?"Enter the carat weight above":"—")}
                </div>
              </div>
            </div>
            :<Input label={`Total cost (${CUR_SYM})`} value={cost} onChange={setCost} type="number" min="0" step="0.01" placeholder="0.00"/>}
        </div>
      </div>
      {desc&&<div style={{fontSize:12,color:INK,marginTop:2,lineHeight:1.5,background:WHITE,border:`1px solid ${BD}`,borderRadius:4,padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginRight:8}}>Preview</span>{desc}</div>}
      {/* Client price on the stone markup — same maths as the quote's stone section */}
      <div style={{fontSize:12,marginTop:12,lineHeight:1.5,color:preview?(preview.bracket?accent:WARN):WG}}>
        {preview
          ?(preview.bracket?<>→ <strong>{fmtR(preview.clientTotal)}</strong> to client (×{preview.mult} + {TAX_LABEL})</>:"Cost is outside your stone markup table — check the rates in Pricing DB.")
          :"Enter a cost to preview the client price."}
      </div>
      <div style={{display:"flex",justifyContent:"center",marginTop:20}}>
        <Btn onClick={addStone} disabled={cn<=0}>Add to quote</Btn>
      </div>
    </div>
  </Modal>;
}

// ── Findings & Components Modal ───────────────────────────────────────────
// ── Centre Stone Setting calculator ───────────────────────────────────────
// Unified stone-setting picker: style × (mm|carat) × careful uplift × count → a marked-up line item.
function SettingPicker({onAdd,settingRates=DEFAULT_SETTING_RATES,pricing=[]}){
  const isMobile=useIsMobile();
  const accentStyles=settingRates.accentStyles?.length?settingRates.accentStyles:ACCENT_STYLES_SEED;
  const centreStyles=settingRates.centreStyles?.length?settingRates.centreStyles:CENTRE_STYLES_SEED;
  const mmSizes=[...new Set(pricing.filter(p=>p.category==="Basic Setting").map(p=>Number(p.sizeMm)).filter(n=>n>0))].sort((a,b)=>a-b);
  const[styleId,setStyleId]=useState(accentStyles[0]?.id||"prong");
  const[mode,setMode]=useState("mm");
  // Accent/melee (mm) uses the accent style list; centre/feature (carat) uses the centre list.
  const styles=mode==="carat"?centreStyles:accentStyles;
  useEffect(()=>{setStyleId(prev=>styles.some(s=>s.id===prev)?prev:(styles[0]?.id||""));},[mode]);   // eslint-disable-line react-hooks/exhaustive-deps
  const[sizeMm,setSizeMm]=useState(mmSizes.includes(1.5)?1.5:(mmSizes[Math.floor(mmSizes.length/2)]||1.5));
  const[carat,setCarat]=useState("");
  const[count,setCount]=useState("1");
  const[careful,setCareful]=useState(false);
  const[platinum,setPlatinum]=useState(false);
  const style=styles.find(s=>s.id===styleId)||styles[0];
  const styleMult=Number(style?.mult)||1;
  const n=Math.max(1,Number(count)||1);
  const upPct=Number(settingRates.carefulUpliftPct)||0;
  const upMult=careful?1+upPct/100:1;
  const platPct=Number(settingRates.platinumUpliftPct)||0;
  const platMult=platinum?1+platPct/100:1;
  const volMult=settingVolumeMult(n,settingRates);
  const fee=settingFee({mode,sizeMm,carat,styleMult,careful,platinum,count:n},settingRates,pricing);
  const add=()=>{
    if(fee<=0)return;
    const tags=[careful&&`extra care +${upPct}%`,platinum&&`platinum +${platPct}%`,volMult<1&&`volume −${Math.round((1-volMult)*100)}%`].filter(Boolean);
    const tagTxt=tags.length?` · ${tags.join(" · ")}`:"";
    const desc=`${style.name} setting${careful?" (precious / high value)":""}${platinum?" · platinum":""}`;
    const detail=mode==="carat"
      ?`${Number(carat)||0}ct · ${style.name}${tagTxt}`
      :`${n} stone${n!==1?"s":""} × ${sizeMm}mm · ${style.name}${tagTxt}`;
    onAdd(desc,detail,fee);
  };
  return <div>
    <div style={{fontSize:12,color:WG,lineHeight:1.6,marginBottom:14}}>Pick the setting style, size the stone(s), and mark it <strong style={{color:INK}}>precious / high value</strong> if it needs extra care to set. Edit the rates in <strong style={{color:INK}}>Pricing DB → Stone Setting</strong>.</div>
    <label style={SS.lbl}>Setting style</label>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6,marginBottom:14}}>
      {styles.map(s=>{const on=s.id===styleId;return <button key={s.id} onClick={()=>setStyleId(s.id)} style={{padding:"7px 12px",borderRadius:4,border:`1px solid ${on?GOLD:BD}`,background:on?GOLD:WHITE,color:on?WHITE:INK,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{s.name}{Number(s.mult)!==1&&<span style={{opacity:0.7,fontWeight:400}}> ×{s.mult}</span>}</button>;})}
    </div>
    <div style={{marginBottom:20}}>
      <label style={SS.lbl}>What are you setting?</label>
      <div style={{display:"inline-flex",border:`1px solid ${BD}`,borderRadius:4,overflow:"hidden",marginTop:6,maxWidth:"100%"}}>
        {[["mm","Accent / melee — by mm"],["carat","Centre / feature stone — by carat"]].map(([m,lbl],i)=><button key={m} onClick={()=>setMode(m)} style={{padding:"8px 14px",border:"none",borderLeft:i?`1px solid ${BD}`:"none",background:mode===m?INK:WHITE,color:mode===m?WHITE:WG,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{lbl}</button>)}
      </div>
      <div style={{fontSize:11,color:WG,marginTop:6,lineHeight:1.5}}>{mode==="mm"?"Small accent/melee stones — priced per stone by size (mm).":"Your centre or feature stone — priced by its carat weight."}</div>
    </div>
    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:18}}>
      {mode==="mm"
        ?<div><label style={SS.lbl}>Stone size</label><select value={String(sizeMm)} onChange={e=>setSizeMm(Number(e.target.value))} style={{...SS.inp,marginTop:6,width:140}}>{mmSizes.map(m=><option key={m} value={String(m)}>{m}mm</option>)}</select></div>
        :<div><label style={SS.lbl}>Centre stone carat</label><input type="number" min="0" step="0.01" value={carat} onChange={e=>setCarat(e.target.value)} placeholder="e.g. 1.50" style={{...SS.inp,marginTop:6,width:140}}/></div>}
      <div><label style={SS.lbl}>How many</label><input type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} style={{...SS.inp,marginTop:6,width:120}}/></div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
      <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
        <input type="checkbox" checked={careful} onChange={e=>setCareful(e.target.checked)}/>
        <span style={{fontSize:13,color:INK,fontWeight:600}}>Precious / High Value <span style={{fontWeight:400,color:WG}}>(Extra Care Needed) · +{upPct}%</span></span>
      </label>
      <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
        <input type="checkbox" checked={platinum} onChange={e=>setPlatinum(e.target.checked)}/>
        <span style={{fontSize:13,color:INK,fontWeight:600}}>Platinum <span style={{fontWeight:400,color:WG}}>(harder to set) · +{platPct}%</span></span>
      </label>
      {volMult<1&&<div style={{fontSize:12,color:OK,fontWeight:700}}>Volume rate — {Math.round((1-volMult)*100)}% off per stone for {n} stones.</div>}
    </div>
    <div style={{background:fee>0?OK+"11":PARCH,border:`1px solid ${fee>0?OK:BD}`,borderRadius:4,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{minWidth:0}}>
        <div style={{fontSize:12,fontWeight:700,color:INK}}>{style?.name} setting{careful?" · extra care":""}{platinum?" · platinum":""}</div>
        <div style={{fontSize:12,color:WG,marginTop:2}}>{fee>0?[
          mode==="carat"?`${Number(carat)||0}ct → ${fmt(settingCaratBase(carat,settingRates))} base`:`${n} × ${sizeMm}mm base`,
          styleMult!==1&&`× ${styleMult}`,
          careful&&`× ${upMult.toFixed(2)} care`,
          platinum&&`× ${platMult.toFixed(2)} plat`,
          volMult<1&&`× ${volMult.toFixed(2)} vol`,
        ].filter(Boolean).join(" "):"Set the size to calculate"}</div>
      </div>
      <div style={{display:"flex",gap:12,alignItems:"center",flexShrink:0}}>
        <div style={{fontSize:20,fontWeight:800,color:fee>0?OK:WG}}>{fmt(fee)}</div>
        <Btn disabled={fee<=0} onClick={add}>Add to quote</Btn>
      </div>
    </div>
  </div>;
}

function QuoteBuilder({jobId:jobIdProp,editQuoteId,stockId,stock,setStock,jobs,clients,quotes,setQuotes,pricing,setPricing,markupTable,naturalStoneMarkup,labStoneMarkup,tradeMarkupTable=[],tradeNatStoneMarkup=[],tradeLabStoneMarkup=[],centreRates=DEFAULT_SETTING_RATES,setCentreRates,invoices=[],setInvoices,setView}){
  // Wider "stack" breakpoint (1024) than the app default (768): the line-item editor is a wide
  // multi-column table, so it stacks into cards on tablets too, not just phones.
  const isMobile=useIsMobile(1024);
  const existingQuote=editQuoteId?quotes.find(q=>q.id===editQuoteId):null;
  // Stock-pricing mode: same builder, but the total becomes a stock piece's price (no quote/proposal chrome).
  const stockMode=!!stockId;
  const stockItem=stockMode?(stock||[]).find(s=>s.id===stockId):null;
  const seed=existingQuote||(stockMode?stockItem?.pricing:null);   // re-pricing seeds from the saved payload
  const jobId=existingQuote?.jobId||jobIdProp;
  const job=jobs.find(j=>j.id===jobId);
  const c=job?clients.find(x=>x.id===job.clientId):null;
  const isEditing=!!existingQuote;
  const blankItem=()=>({id:uid(),description:"",detail:"",costLow:"",noMarkup:false});
  // Findings are no longer a separate section — fold any legacy finding:true items back
  // into the main line items (stripping the flag) so old quotes keep them, editable as normal.
  const[items,setItems]=useState(()=>seed?.lineItems?.length?seed.lineItems.filter(i=>!i.accentStone).map(({finding,...i})=>({...i})):[]);
  const[accentItems,setAccentItems]=useState(()=>seed?.lineItems?.length?seed.lineItems.filter(i=>i.accentStone).map(i=>({...i})):[]);
  const[notes,setNotes]=useState(seed?.notes||"");
  const[clientDescription,setClientDescription]=useState(seed?.clientDescription||"");
  const[title,setTitle]=useState(seed?.title??(job?.type||""));   // prefill new quotes with the job type
  const[pieceTitle,setPieceTitle]=useState(seed?.pieceTitle||"");  // custom piece name on documents; blank = use job type
  const[markupOverride,setMarkupOverride]=useState(seed?.markupOverride?String(seed.markupOverride):"");
  // Trade pricing: same builder, the lower trade markup profile. Auto-on for trade-account clients
  // (new quotes), restored from the saved quote when editing; never in stock-pricing mode.
  const[pricingMode,setPricingMode]=useState(seed?.pricingMode||((!stockMode&&c?.accountType==="trade")?"trade":"retail"));
  const tradePricing=pricingMode==="trade"&&!stockMode;
  const[stoneOverride,setStoneOverride]=useState(seed?.stoneMarkupOverride?String(seed.stoneMarkupOverride):"");
  const[tradeInCredit,setTradeInCredit]=useState(seed?.tradeInCredit?String(seed.tradeInCredit):"");
  const[tradeInNote,setTradeInNote]=useState(seed?.tradeInNote||"");
  const[manualTotal,setManualTotal]=useState(seed?.manualTotal?String(seed.manualTotal):"");
  const[validUntil,setValidUntil]=useState(seed?.validUntil||"");
  const[pricingModal,setPricingModal]=useState(false);
  const[pSearch,setPSearch]=useState("");
  const[pCat,setPCat]=useState("All");
  const[pQty,setPQty]=useState({});
  const[pcOverride,setPcOverride]=useState("");
  const[pMode,setPMode]=useState({});   // per-item: "qty" (default) or "amt" (manual figure)
  const[manLabel,setManLabel]=useState("");
  const[manAmt,setManAmt]=useState("");
  // Pricing-DB popup: multi-add session — the popup stays open while adding items
  const[addedIds,setAddedIds]=useState({});       // pricing item id → times added this visit
  const[pFlash,setPFlash]=useState(null);         // row currently flashing "✓ added"
  const[sessionAdds,setSessionAdds]=useState([]); // costs added this visit (for the footer tally)
  const markAdded=(id,cost)=>{setAddedIds(p=>({...p,[id]:(p[id]||0)+1}));setSessionAdds(p=>[...p,Number(cost)||0]);setPFlash(id);setTimeout(()=>setPFlash(f=>f===id?null:f),1400);};
  const openPricing=()=>{
    setAddedIds({});setSessionAdds([]);
    // Don't reopen stuck on a picker-only category (Centre Stone Setting) that hides the
    // browsable item list — return to "All" so you can always add ordinary items.
    if(pCat===SETTING_CAT){setPCat("All");}
    setPricingModal(true);
  };
  const closePricing=()=>{setPricingModal(false);};
  useEffect(()=>{
    if(!pricingModal)return;
    const h=e=>{if(e.key==="Escape"){setPricingModal(false);}};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[pricingModal]);
  const[accentModal,setAccentModal]=useState(false);
  const[centreModal,setCentreModal]=useState(false);
  // Centre stone section
  const[stoneMode,setStoneMode]=useState(seed?.stoneMode||"none");
  const[stoneType,setStoneType]=useState(seed?.stoneType||"");
  const[stoneItems,setStoneItems]=useState(()=>seed?.stoneItems?.length?seed.stoneItems.map(i=>({...i})):[]);
  const[stoneNotes,setStoneNotes]=useState(seed?.stoneNotes||"");
  const setStonItem=(id,k,v)=>setStoneItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const removeStoneItem=id=>setStoneItems(p=>p.filter(i=>i.id!==id));

  const setItem=(id,k,v)=>setItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const removeItem=id=>setItems(p=>p.filter(i=>i.id!==id));
  // Switch a metal line between cast and hand-fabricated — recompute cost from the snapshotted per-gram rates.
  const setMetalMethod=(id,method)=>setItems(p=>p.map(li=>{
    if(li.id!==id||!li.metalMethod)return li;
    const perG=method==="fab"?(Number(li.metalFabPerG)||0):(Number(li.metalCastPerG)||0);
    const g=Number(li.metalGrams)||0;
    return{...li,metalMethod:method,costLow:(perG*g).toFixed(2),detail:`${g}g × ${fmt(perG)}/g · ${method==="fab"?"fabricated":"cast"}`};
  }));
  const setAccentItem=(id,k,v)=>setAccentItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const removeAccentItem=id=>setAccentItems(p=>p.filter(i=>i.id!==id));
  const moveItem=(id,dir)=>{
    setItems(p=>{const i=p.findIndex(x=>x.id===id);if(i<0)return p;const n=[...p];const t=n[i+dir];if(!t)return p;n[i+dir]=n[i];n[i]=t;return n;});
  };
  const duplicateItem=id=>setItems(p=>{const i=p.findIndex(x=>x.id===id);if(i<0)return p;const n=[...p];n.splice(i+1,0,{...p[i],id:uid()});return n;});

  const addFromDB=(item,qty)=>{
    const q=Math.max(1,Number(qty)||1);
    const isDiamond=DIAMOND_CATS.includes(item.category);
    const isSetting=item.category==="Basic Setting"||item.category==="Complex Setting";
    const isPrintCast=item.category==="3D Print & Cast";
    // A spot-linked metal (sold by gram) gets a cast/fabricated toggle on its quote line.
    const isMetalLine=item.category==="Metals"&&!!item.metalKey&&item.unit==="g";
    const desc=isDiamond?`${item.category} ${item.sizeMm}mm`
      :isSetting?(item.category==="Complex Setting"?`Complex setting ${item.sizeMm}mm`:`Basic setting ${item.sizeMm}mm`)
      :isPrintCast?`${item.name} (${q} piece${q!==1?"s":""})`
      :item.name;
    const totalCost=(item.baseCost*q).toFixed(2);
    const detail=isDiamond
      ?`${q} stone${q!==1?"s":""} × ${fmt(item.baseCost)}/stone (${item.caratWeight}ct each)`
      :isSetting
      ?`${q} stone${q!==1?"s":""} × ${fmt(item.baseCost)}/stone setting`
      :isPrintCast
      ?`${q} piece${q!==1?"s":""} × ${fmt(item.baseCost)}/piece`
      :item.unit==="hr"?`${q} hr × ${fmt(item.baseCost)}/hr`
      :isMetalLine?`${q}g × ${fmt(item.baseCost)}/g · cast`
      :item.unit==="g"?`${q}g × ${fmt(item.baseCost)}/g`
      :item.unit==="piece"?`${q} piece${q!==1?"s":""}`
      :item.unit==="stone"?`${q} stone${q!==1?"s":""}`
      :q>1?`× ${q}`:"";
    // Snapshot both per-gram costs so the line's Cast/Fabricated toggle can switch without spot access.
    const metalFields=isMetalLine?{metalMethod:"cast",metalGrams:q,metalCastPerG:Number(item.baseCost)||0,metalFabPerG:Number(item.baseCostFab!=null?item.baseCostFab:item.baseCost)||0}:{};
    setItems(p=>[...p,{id:uid(),description:desc,detail,costLow:String(totalCost),noMarkup:item.noMarkup||false,...metalFields}]);
    setPQty(p=>({...p,[item.id]:""}));   // clear this row's qty; popup stays open for more adds
    markAdded(item.id,totalCost);
  };

  // Add a stone-setting line from the unified SettingPicker (cost snapshot; marked up like any line).
  const addSetting=(desc,detail,cost)=>{
    const amt=Number(cost)||0;
    if(amt<=0)return;
    setItems(p=>[...p,{id:uid(),description:desc,detail,costLow:amt.toFixed(2),noMarkup:false}]);
    markAdded("setting",amt);
  };

  const addCustomPrintCast=()=>{
    const price=Number(pcOverride)||0;
    if(price<=0)return alert("Enter a price.");
    setItems(p=>[...p,{id:uid(),description:"3D Print & Cast",detail:"Manual price",costLow:price.toFixed(2),noMarkup:false}]);
    setPcOverride("");
    markAdded("printcast-manual",price);
  };

  // Quick manual line from inside the pricing-DB popup (keeps the popup open so you can keep adding)
  const addManual=()=>{
    const amt=Number(manAmt)||0;
    if(amt<=0)return alert("Enter an amount.");
    setItems(p=>[...p,{id:uid(),description:manLabel.trim()||"Manual price",detail:"Manual price",costLow:amt.toFixed(2),noMarkup:false}]);
    setManLabel("");setManAmt("");
    markAdded("manual-line",amt);
  };

  const addManualAmount=(item,amount)=>{
    const amt=Number(amount)||0;
    if(amt<=0)return alert("Enter an amount.");
    const isD=DIAMOND_CATS.includes(item.category);
    const isS=item.category==="Basic Setting"||item.category==="Complex Setting";
    const desc=isD?`${item.category} ${item.sizeMm}mm`
      :isS?(item.category==="Complex Setting"?`Complex setting ${item.sizeMm}mm`:`Basic setting ${item.sizeMm}mm`)
      :item.name;
    setItems(p=>[...p,{id:uid(),description:desc,detail:"Manual price",costLow:amt.toFixed(2),noMarkup:false}]);
    setPQty(p=>({...p,[item.id]:""}));   // clear this row only; popup stays open for more adds
    markAdded(item.id,amt);
  };

  const validAccentItems=accentItems.filter(i=>i.description.trim()&&Number(i.costLow)>0);
  // Manufacturing-markup accents join the jewellery list (same markup); natural/lab accents
  // are priced separately, so they keep their own section.
  const mfgAccents=accentItems.filter(i=>(i.markupMode||"mfg")==="mfg");
  const stoneAccents=accentItems.filter(i=>i.markupMode==="natural"||i.markupMode==="lab");
  const validItems=[...items.filter(i=>i.description.trim()&&Number(i.costLow)>0),...validAccentItems];
  // Trade quotes use the lower trade markup profile for metal/labour and for stones.
  const mkTable=tradePricing?tradeMarkupTable:markupTable;
  const natTable=tradePricing?tradeNatStoneMarkup:naturalStoneMarkup;
  const labTable=tradePricing?tradeLabStoneMarkup:labStoneMarkup;
  const calc=calcQuote(validItems.length?validItems:items,mkTable,markupOverride,tradePricing);
  const validStoneItems=stoneItems.filter(i=>(Number(i.cost)||Number(i.costLow))>0);
  const activeStoneMarkup=stoneType==="lab"?labTable:natTable;
  const stoneCalc=stoneMode==="sourcing"&&stoneType&&validStoneItems.length>0?calcStoneQuote(validStoneItems,activeStoneMarkup,stoneOverride):null;
  const stoneClientTotal=stoneCalc?.clientTotal||0;
  // Accent/fancy stones set to follow the stone markup — each priced like the centre stone (cost × stone tier + 10% GST)
  const accentStoneItems=validAccentItems.filter(i=>i.markupMode==="natural"||i.markupMode==="lab");
  const accentStoneTotal=accentStoneItems.reduce((s,i)=>{const sc=calcStoneQuote([{cost:i.costLow}],i.markupMode==="lab"?labTable:natTable);return s+(sc?.clientTotal||0);},0);
  // Snapshot trade multiplier stored on the quote so every downstream total (invoices, proposals,
  // job/dashboard figures) reprices via effMarkupOverride without threading the trade table around.
  const tradeMultVal=tradePricing?(getBracket(calc.base,tradeMarkupTable)?.multiplier||1):0;
  const grandTotal=calc.finalLow+stoneClientTotal+accentStoneTotal;
  const manualOn=Number(manualTotal)>0;
  const tradeInN=Number(tradeInCredit)||0;                                   // gold trade-in credit (deduction)
  const payableTotal=Math.max(0,(manualOn?Number(manualTotal):grandTotal)-tradeInN);   // amount payable after trade-in

  // If this quote is already on an invoice, editing it can drift the invoice's figures — warn, and
  // offer to re-sync the invoice (same maths as invoice creation; keeps number/date/status/discount).
  const linkedInvoice=editQuoteId?(invoices||[]).find(i=>(i.quoteIds||(i.quoteId?[i.quoteId]:[])).includes(editQuoteId)):null;

  const save_=status=>{
    if(!guardEdit())return;
    const baseValidItems=items.filter(i=>i.description.trim()&&Number(i.costLow)>0);
    const hasSourcedStones=stoneMode==="sourcing"&&validStoneItems.length>0;
    if(!baseValidItems.length&&!validAccentItems.length&&!hasSourcedStones&&!manualOn)return alert("Add at least one cost item — a line item, a sourced stone, or a manual quoted price.");
    if(stockMode){
      // Persist the full pricing payload (so it can be reopened & re-priced), plus the resulting
      // cost + retail (inc GST) onto the stock piece. Retail auto-fills but stays editable in Stock.
      const payload={title:title.trim(),markupOverride:Number(markupOverride)||0,manualTotal:Number(manualTotal)||0,notes,lineItems:validItems,
        stoneMode,stoneType:stoneMode==="sourcing"?stoneType:"",stoneItems:stoneMode==="sourcing"?validStoneItems:[],stoneMarkupOverride:Number(stoneOverride)||0,
        stoneNotes,stoneClientTotal:stoneCalc?.clientTotal||0,accentStoneTotal};
      const sourcedStoneCost=stoneMode==="sourcing"?validStoneItems.reduce((s,i)=>s+(Number(i.cost)||Number(i.costLow)||0),0):0;
      // Your true cost = marked-up items' cost (base) + at-cost items (flatCost, ex any GST) + any sourced stones.
      const costTotal=calc.base+calc.flatCost+sourcedStoneCost;
      const retail=manualOn?Number(manualTotal):grandTotal;
      setStock(p=>{const n=p.map(s=>s.id===stockId?{...s,pricing:payload,cost:Math.round(costTotal),price:Math.round(retail),pricedAt:today()}:s);persist(K.st,n);return n;});
      setView("stock");
      return;
    }
    if(isEditing){
      // Update existing quote — preserve id, jobId, createdAt
      const updated={...existingQuote,status,title:title.trim(),pieceTitle:pieceTitle.trim(),markupOverride:Number(markupOverride)||0,pricingMode:tradePricing?"trade":"retail",tradeMult:tradeMultVal,manualTotal:Number(manualTotal)||0,validUntil,notes,lineItems:validItems,
        stoneMode,stoneType:stoneMode==="sourcing"?stoneType:"",stoneItems:stoneMode==="sourcing"?validStoneItems:[],stoneMarkupOverride:Number(stoneOverride)||0,
        stoneNotes,stoneClientTotal:stoneCalc?.clientTotal||0,accentStoneTotal,tradeInCredit:Number(tradeInCredit)||0,tradeInNote:tradeInNote.trim(),clientDescription,updatedAt:today()};
      const nextQuotes=quotes.map(q=>q.id===editQuoteId?updated:q);
      setQuotes(()=>{persist(K.qu,nextQuotes);return nextQuotes;});
      // Invoiced quote edited → bring the invoice's figures in line with the new quote.
      // Total changed: ask first (the client may already have the issued invoice).
      // Total unchanged: refresh descriptions/line detail silently — the money is untouched.
      if(linkedInvoice&&setInvoices){
        const oldTotal=Number(linkedInvoice.totalIncGST)||0;
        const synced=resyncInvoiceWithQuotes(linkedInvoice,nextQuotes,job,markupTable);
        const newTotal=Number(synced.totalIncGST)||0;
        const apply=Math.abs(newTotal-oldTotal)<=0.005
          ||confirm(`This quote is on invoice ${linkedInvoice.number||""} (currently ${fmt(oldTotal)}).\n\nUpdate the invoice to match the new figures (${fmt(newTotal)})? It keeps its number, date, status and any discount.\n\nOK = update invoice · Cancel = leave the invoice as issued`);
        if(apply)setInvoices(p=>{const n=p.map(i=>i.id===linkedInvoice.id?synced:i);persist(K.inv,n);return n;});
      }
    }else{
      const q={id:uid(),jobId,status,title:title.trim(),pieceTitle:pieceTitle.trim(),markupOverride:Number(markupOverride)||0,pricingMode:tradePricing?"trade":"retail",tradeMult:tradeMultVal,manualTotal:Number(manualTotal)||0,createdAt:today(),validUntil,notes,lineItems:validItems,
        stoneMode,stoneType:stoneMode==="sourcing"?stoneType:"",stoneItems:stoneMode==="sourcing"?validStoneItems:[],stoneMarkupOverride:Number(stoneOverride)||0,
        stoneNotes,stoneClientTotal:stoneCalc?.clientTotal||0,accentStoneTotal,tradeInCredit:Number(tradeInCredit)||0,tradeInNote:tradeInNote.trim(),clientDescription};
      setQuotes(p=>{const n=[...p,q];persist(K.qu,n);return n;});
    }
    setView("jobDetail_"+jobId);
  };

  // Typing in the search box searches the WHOLE pricing DB (ignores the selected category)
  const pSearching=pSearch.trim()!=="";
  const fp=pSearching
    ?pricing.filter(p=>p.name.toLowerCase().includes(pSearch.toLowerCase()))
    :pricing.filter(p=>pCat==="All"||p.category===pCat);

  return <div>
    <div style={{marginBottom:20}}>
      <h1 style={{margin:0,fontSize:isMobile?19:24,fontWeight:700,color:INK,wordBreak:"break-word"}}>{stockMode?(seed?"Update price":"Generate price"):(isEditing?"Edit quote":"New quote")}{title.trim()?`: ${title.trim()}`:(stockMode&&stockItem?.title?`: ${stockItem.title}`:"")}</h1>
      {job&&<div style={{color:WG,fontSize:13,marginTop:3}}>{job.type} · {clientDisplayName(c)}</div>}
      {stockMode&&<div style={{color:WG,fontSize:13,marginTop:3}}>Pricing a stock piece — builds like a quote, but the total becomes this piece's price.</div>}
      {isEditing&&!stockMode&&<div style={{fontSize:12,color:WG,marginTop:2}}>Quote {quoteRef(existingQuote)} · created {fmtDate(existingQuote.createdAt)}</div>}
      {linkedInvoice&&<div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,background:GOLD_L,border:`1px solid ${GOLD}66`,borderRadius:6,padding:"10px 14px",fontSize:12.5,color:GOLD_D,lineHeight:1.5}}>
        <span style={{fontSize:15}}>⚠</span>
        <span>This quote is already on <strong>invoice {linkedInvoice.number||""}</strong> ({fmt(Number(linkedInvoice.totalIncGST)||0)}). If your changes alter the price, you'll be asked whether to update the invoice to match when you save.</span>
      </div>}
    </div>

    <Card>
      {/* ── Quote title + expiry + client description (quotes only; stock shows just an internal label) ── */}
      {stockMode
        ? <div style={{marginBottom:20}}>
            <Input label="Price label (optional)" value={title} onChange={setTitle} placeholder="What this pricing covers — for your reference only"/>
          </div>
        : <div style={{marginBottom:20}}>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 200px",gap:"0 24px",marginBottom:16}}>
              <Input label="Quote title / label" value={title} onChange={setTitle} placeholder="e.g. Engagement ring, Diamond upgrade, Repair…"/>
              <Input label={<>Quote expiry date<InfoDot text="After this date the quote counts as expired — the client can no longer accept it online and it drops out of your dashboard pipeline. Edit this date or re-send the proposal to keep it live."/></>} value={validUntil} onChange={setValidUntil} type="date"/>
            </div>
            <div style={{marginBottom:16}}>
              <Input label="Piece name on documents (optional)" value={pieceTitle} onChange={setPieceTitle} placeholder={`Heading for the piece — blank uses the job type${job?.type?` (“${job.type}”)`:""}. e.g. Solitaire engagement ring`}/>
            </div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",rowGap:6,marginBottom:6}}>
                <label style={SS.lbl}>Description for client</label>
                <div style={{background:OK+"22",color:OK,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>APPEARS ON PROPOSAL</div>
              </div>
              <textarea value={clientDescription} onChange={e=>setClientDescription(e.target.value)} rows={4}
                placeholder="e.g. Custom 18ct white gold engagement ring featuring a 1.52ct oval-cut sapphire with a diamond pavé halo. All stones hand-selected and set in our studio."
                style={{...SS.inp,marginTop:0,resize:"vertical",lineHeight:1.6,fontSize:13}}/>
            </div>
          </div>}
      <div style={{borderTop:`1px solid ${BD}`,margin:"0 0 20px"}}/>

      {/* ── Setting & manufacturing line items ── */}
      <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12,display:"flex",alignItems:"center"}}>Jewellery costs<InfoDot text="Your true costs for the piece — metal, labour, CAD, setting and so on. Your markup is applied on top to reach the client price; the summary shows cost → markup → price incl. tax."/></div>
      <div style={{background:GOLD_L+"55",border:`1px solid ${GOLD}55`,borderRadius:4,padding:"11px 14px",marginBottom:14,fontSize:12.5,color:INK,lineHeight:1.65}}>
        <strong>The pricing database is just a starting point.</strong> It holds the simple, most commonly-used items for quoting everyday jewellery — but every studio works with different suppliers and materials. Feel free to add your own <strong>manual costings</strong> any time with <strong>+ Add item</strong>; they mark up and total exactly the same way.
        <div style={{color:WG,marginTop:6}}>For example, making a wedding ring with 15 × 2mm blue sapphires? Call your supplier for your real cost, then add it here as a manual entry — that way your quote always reflects your actual pricing.</div>
        <div style={{color:WG,marginTop:6}}>You can also do this straight from <strong>⊕ Pricing DB</strong> — the <strong>Manual price</strong> box at the top lets you type a label and price and add it to the quote as its own line entry.</div>
      </div>
      {(items.length>0||mfgAccents.length>0)&&<>{!isMobile&&<div style={{display:"grid",gridTemplateColumns:"minmax(240px,1.6fr) 1fr 120px 104px",gap:8,marginBottom:6,padding:"0 2px"}}>
        {["Item","Detail / calculation","Cost",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>)}
      </div>}
      <div style={{fontSize:11,color:WG,marginBottom:10,lineHeight:1.5}}>Toggle <strong style={{color:"#96627C"}}>No markup</strong> on any item to add it at exact cost after markup is applied.</div></>}
      {items.length===0&&mfgAccents.length===0&&!(stoneMode==="sourcing"&&stoneType&&stoneItems.length>0)&&
        <div style={{border:`1px dashed ${BD}`,borderRadius:5,padding:"16px 18px",marginBottom:12,fontSize:12.5,color:WG,lineHeight:1.6,textAlign:"center"}}>
          No line items yet. Add from your <strong style={{color:GOLD_D}}>⊕ Pricing DB</strong>, or hit <strong style={{color:GOLD_D}}>+ Add item</strong> to type your own — both mark up and total the same way.
        </div>}
      {items.map((li,idx)=>{
        const cost=Number(li.costLow)||0;
        const totalStr=cost>0?fmt(cost):"—";
        const actBtn={display:"inline-flex",alignItems:"center",gap:5,background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:600,color:WG,cursor:"pointer",fontFamily:"inherit",lineHeight:1.3,whiteSpace:"nowrap"};
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"minmax(240px,1.6fr) 1fr 120px 104px",columnGap:8,rowGap:isMobile?7:8,marginBottom:isMobile?16:8,alignItems:"center",...(isMobile?{padding:"10px",border:`1px solid ${BD}`,borderRadius:6,background:PARCH}:{})}}>
          <input value={li.description} onChange={e=>setItem(li.id,"description",e.target.value)} placeholder="Item — e.g. 9ct white gold" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",gridColumn:isMobile?"1 / -1":"auto"}}/>
          <input value={li.detail} onChange={e=>setItem(li.id,"detail",e.target.value)} placeholder={`Detail — e.g. 5g × ${CUR_SYM}110/g`} style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",color:WG,gridColumn:isMobile?"1 / -1":"auto"}}/>
          <input type="number" value={li.costLow} onChange={e=>setItem(li.id,"costLow",e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px",textAlign:"right"}}/>
          <div style={{fontSize:13,fontWeight:700,color:INK,textAlign:"right",whiteSpace:"nowrap"}}>{totalStr}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",gridColumn:"1 / -1",marginTop:isMobile?2:4}}>
            {li.metalMethod&&<div style={{display:"inline-flex",border:`1px solid ${BD}`,borderRadius:6,overflow:"hidden",flexShrink:0}} title="Metal supply — pick one: Cast (casting-house premium) or hand-Fabricated (mill metal)">
              {[["cast","Cast",Number(li.metalCastPerG)||0],["fab","Fabricated",Number(li.metalFabPerG)||0]].map(([m,lbl,perG],i)=>{
                const on=li.metalMethod===m;
                return <button key={m} onClick={()=>setMetalMethod(li.id,m)}
                  title={`${m==="fab"?"Hand-fabricated (mill metal)":"Cast (casting-house premium)"} — ${fmt(perG)}/g`}
                  style={{background:on?GOLD:WHITE,border:"none",borderLeft:i?`1px solid ${BD}`:"none",padding:"4px 10px",fontSize:12,fontWeight:600,color:on?WHITE:WG,cursor:on?"default":"pointer",lineHeight:1.3,whiteSpace:"nowrap"}}>{lbl}</button>;
              })}
            </div>}
            <button
              onClick={()=>setItem(li.id,"noMarkup",!li.noMarkup)}
              title={li.noMarkup?"This line is excluded from your markup — click to include it":"This line is included in your markup — click to exclude it (charge at cost)"}
              style={li.noMarkup
                ?{...actBtn,background:"#96627C",border:"1px solid #96627C",color:WHITE}
                :{...actBtn,border:`1px solid ${GOLD}`,color:GOLD_D}}>
              {li.noMarkup?"No markup":"Markup ✓"}
            </button>
            <button onClick={()=>duplicateItem(li.id)} title="Duplicate this line" style={actBtn}><span style={{fontSize:13}}>⧉</span> Duplicate</button>
            {idx>0&&<button onClick={()=>moveItem(li.id,-1)} title="Move this line up" style={actBtn}><span style={{fontSize:13}}>↑</span> Move up</button>}
            <button onClick={()=>removeItem(li.id)} title="Delete this line" style={{...actBtn,color:DANGER,border:`1px solid ${DANGER}55`}}><span style={{fontSize:14,lineHeight:1}}>✕</span> Delete</button>
          </div>
        </div>;})}
      {/* Manufacturing-markup accent stones — folded into the jewellery costs list (editable) */}
      {mfgAccents.map(li=>{
        const cost=Number(li.costLow)||0;
        const totalStr=cost>0?fmt(cost):"—";
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"minmax(240px,1.6fr) 1fr 120px 104px",columnGap:8,rowGap:isMobile?7:8,marginBottom:isMobile?16:8,alignItems:"center",...(isMobile?{padding:"10px",border:`1px solid ${BD}`,borderRadius:6,background:PARCH}:{})}}>
          <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,gridColumn:isMobile?"1 / -1":"auto"}}>
            <span style={{background:"#EDF5EF",color:"#4E8B6A",fontSize:8,fontWeight:800,padding:"3px 5px",borderRadius:3,letterSpacing:"0.04em",flexShrink:0}} title="Accent, feature or fancy stone">ACCENT</span>
            <input value={li.description} onChange={e=>setAccentItem(li.id,"description",e.target.value)} placeholder="e.g. pear sapphire" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",flex:1,minWidth:0}}/>
          </div>
          <input value={li.detail||""} onChange={e=>setAccentItem(li.id,"detail",e.target.value)} placeholder="notes (optional)" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",color:WG,gridColumn:isMobile?"1 / -1":"auto"}}/>
          <input type="number" value={li.costLow} onChange={e=>setAccentItem(li.id,"costLow",e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px",textAlign:"right"}}/>
          <div style={{fontSize:13,fontWeight:700,color:INK,textAlign:"right",whiteSpace:"nowrap"}}>{totalStr}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",gridColumn:"1 / -1",marginTop:isMobile?2:4}}>
            <button onClick={()=>removeAccentItem(li.id)} title="Delete this line" style={{display:"inline-flex",alignItems:"center",gap:5,background:"none",border:`1px solid ${DANGER}55`,borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:600,color:DANGER,cursor:"pointer",fontFamily:"inherit",lineHeight:1.3,whiteSpace:"nowrap"}}><span style={{fontSize:14,lineHeight:1}}>✕</span> Delete</button>
          </div>
        </div>;})}
      {/* Sourced centre / feature stone — folded into the jewellery costs list (priced on the stone markup) */}
      {stoneMode==="sourcing"&&stoneType&&stoneItems.map(li=>{
        const stoneCost=Number(li.cost)||Number(li.costLow)||0;
        const accent=stoneType==="lab"?"#96627C":"#4E8B6A";
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"minmax(240px,1.6fr) 1fr 120px 104px",columnGap:8,rowGap:isMobile?7:8,marginBottom:isMobile?16:8,alignItems:"center",...(isMobile?{padding:"10px",border:`1px solid ${BD}`,borderRadius:6,background:PARCH}:{})}}>
          <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,gridColumn:isMobile?"1 / -1":"auto"}}>
            <span style={{background:accent+"18",color:accent,fontSize:8,fontWeight:800,padding:"3px 5px",borderRadius:3,letterSpacing:"0.04em",flexShrink:0,whiteSpace:"nowrap"}} title="Centre / feature stone — priced on the stone markup">CENTRE · {stoneType==="lab"?"LAB":"NAT"}</span>
            <input value={li.description} onChange={e=>setStonItem(li.id,"description",e.target.value)} placeholder="e.g. 1.52ct oval sapphire" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",flex:1,minWidth:0}}/>
          </div>
          <input value={li.detail} onChange={e=>setStonItem(li.id,"detail",e.target.value)} placeholder="cert / source / notes" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",color:WG,gridColumn:isMobile?"1 / -1":"auto"}}/>
          <input type="number" value={li.cost||""} onChange={e=>setStonItem(li.id,"cost",e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px",textAlign:"right"}}/>
          <div style={{fontSize:13,fontWeight:700,color:INK,textAlign:"right",whiteSpace:"nowrap"}}>{stoneCost>0?fmt(stoneCost):"—"}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",gridColumn:"1 / -1",marginTop:isMobile?2:4}}>
            <button onClick={()=>removeStoneItem(li.id)} title="Delete this line" style={{display:"inline-flex",alignItems:"center",gap:5,background:"none",border:`1px solid ${DANGER}55`,borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:600,color:DANGER,cursor:"pointer",fontFamily:"inherit",lineHeight:1.3,whiteSpace:"nowrap"}}><span style={{fontSize:14,lineHeight:1}}>✕</span> Delete</button>
          </div>
        </div>;})}
      <div style={{display:"flex",gap:10,marginTop:20,flexWrap:"wrap"}}>
        <button onClick={()=>setItems(p=>[...p,blankItem()])} style={{background:"none",border:`1px dashed ${GOLD}`,borderRadius:4,padding:"6px 14px",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add item</button>
        <button onClick={openPricing} style={{background:GOLD_L,border:`1px solid ${GOLD}`,borderRadius:4,padding:"6px 14px",color:GOLD_D,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⊕ Pricing DB</button>
        <button onClick={()=>setAccentModal(true)} style={{background:"#EDF5EF",border:"1px solid #A6CBB4",borderRadius:4,padding:"6px 14px",color:"#4E8B6A",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Accent, feature or fancy stone</button>
        {stoneMode==="sourcing"&&stoneType&&<button onClick={()=>setCentreModal(true)} style={{background:(stoneType==="lab"?"#96627C":"#4E8B6A")+"18",border:`1px solid ${stoneType==="lab"?"#96627C":"#4E8B6A"}`,borderRadius:4,padding:"6px 14px",color:stoneType==="lab"?"#96627C":"#4E8B6A",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Centre stone</button>}
      </div>
      <div style={{fontSize:11,color:WG,margin:"8px 0 20px",lineHeight:1.5}}>Custom coloured or fancy-cut stones aren't in the pricing DB — add them with <strong style={{color:"#4E8B6A"}}>+ Accent, feature or fancy stone</strong>. They default to manufacturing markup and join the costs above; switch a pricey one to <strong>Natural</strong>/<strong>Lab</strong> stone markup to price it separately below.</div>
      {!stockMode&&<div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:tradePricing?"#EDF5EF":PARCH,border:`1px solid ${tradePricing?"#A6CBB4":BD}`,borderRadius:8,padding:"10px 14px",marginBottom:20}}>
        <span style={{fontSize:12,fontWeight:700,color:INK,display:"inline-flex",alignItems:"center"}}>Pricing<InfoDot text="Retail prices through your standard markups. Trade uses your lower wholesale markups (Settings → Trade markups) and adds tax on top. Trade-account clients default to Trade."/></span>
        <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:8,overflow:"hidden"}}>
          {[["retail","Retail"],["trade","Trade"]].map(([v,t])=>(
            <button key={v} type="button" onClick={()=>setPricingMode(v)} style={{border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,padding:"7px 16px",background:pricingMode===v?(v==="trade"?"#4E8B6A":GOLD):WHITE,color:pricingMode===v?WHITE:WG}}>{t}</button>
          ))}
        </div>
        {tradePricing
          ?<span style={{fontSize:12,color:"#4E8B6A",fontWeight:700}}>Trade markups applied{c?.name?` · ${c.name}`:""}</span>
          :<span style={{fontSize:12,color:WG}}>{c?.accountType==="trade"?"This is a trade account — switch to Trade for wholesale markups.":"Standard retail markups."}</span>}
      </div>}
      {validItems.length>0&&<div style={{marginBottom:28}}>
        <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Markup preview{tradePricing?" · Trade":""}</div>
        <MarkupSummary {...calc} large/>
        {/* Manual markup override */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12,flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:700,color:WG,display:"inline-flex",alignItems:"center"}}>Markup multiplier<InfoDot text="Override the automatic markup for this quote only. Leave it on auto to use your markup table based on the cost bracket."/></span>
          <div style={{position:"relative",width:120}}>
            <input type="number" value={markupOverride} onChange={e=>setMarkupOverride(e.target.value)} placeholder={`${calc.autoMult} auto`} min="0" step="0.05"
              style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 22px 7px 10px",textAlign:"right",fontWeight:markupOverride?700:400,borderColor:markupOverride?GOLD:BD}}/>
            <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>×</span>
          </div>
          {markupOverride
            ?<><span style={{fontSize:12,color:GOLD_D,fontWeight:700}}>Override on · table suggests {calc.autoMult}×</span>
               <button onClick={()=>setMarkupOverride("")} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>Reset to auto</button></>
            :<span style={{fontSize:12,color:WG}}>Blank = use the bracket ({calc.autoMult}×). Type a value to override this quote only.</span>}
        </div>
      </div>}

      {/* ── Accent stones priced on the stone markup (natural / lab) ── */}
      {stoneAccents.length>0&&<div style={{borderTop:`1px solid ${BD}`,margin:"8px 0 20px",paddingTop:20}}>
        <div style={{fontSize:11,fontWeight:700,color:"#96627C",textTransform:"uppercase",letterSpacing:"0.08em",display:"flex",alignItems:"center"}}>Accent stones on stone markup<InfoDot text="Small / melee stones priced on your stone markup (cost × tier + tax), like the centre stone — separate from the jewellery markup. Switch one to 'Mfg markup' to fold it into the jewellery costs instead."/></div>
        <div style={{fontSize:11,color:WG,margin:"3px 0 12px",lineHeight:1.55}}>These are priced like the centre stone — your cost × the natural/lab stone tier + {TAX_LABEL} — not the jewellery markup. Switch one back to <strong>Mfg markup</strong> to fold it into the jewellery costs above.</div>
        <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr 150px 110px 36px",gap:8,marginBottom:6,padding:"0 2px"}}>
          {["Stone","Notes / detail","Markup","Your cost",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>)}
        </div>
        {stoneAccents.map(li=>{
          const cost=Number(li.costLow)||0;
          const mode=li.markupMode||"mfg";
          const sc=cost>0?calcStoneQuote([{cost:li.costLow}],mode==="lab"?labTable:natTable):null;
          return <div key={li.id} style={{display:"grid",gridTemplateColumns:"1.3fr 1fr 150px 110px 36px",gap:8,marginBottom:8,alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:INK,padding:"7px 0"}}>{li.description||<span style={{color:WG,fontStyle:"italic"}}>—</span>}
              <div style={{fontSize:10,color:sc?(sc.bracket?"#96627C":WARN):WG,marginTop:1}}>{sc?(sc.bracket?`→ ${fmtR(sc.clientTotal)} to client (×${sc.mult} + ${TAX_LABEL})`:"cost outside stone table"):""}</div>
            </div>
            <div style={{fontSize:12,color:WG,padding:"7px 0"}}>{li.detail||"—"}</div>
            <select value={mode} onChange={e=>setAccentItem(li.id,"markupMode",e.target.value)} style={{...SS.inp,marginTop:0,fontSize:12,padding:"7px 8px"}}>
              <option value="mfg">Mfg markup</option>
              <option value="natural">Natural stone</option>
              <option value="lab">Lab stone</option>
            </select>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>$</span>
              <input type="number" value={li.costLow} onChange={e=>setAccentItem(li.id,"costLow",e.target.value)} placeholder="0.00" min="0" step="0.01"
                style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px 7px 22px",textAlign:"right",borderColor:cost>0?"#CDB2C1":BD,fontWeight:cost>0?700:400}}/>
            </div>
            <button onClick={()=>removeAccentItem(li.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:17,padding:0,lineHeight:1,textAlign:"center"}}>×</button>
          </div>;
        })}
      </div>}

      {/* ── Centre / feature stone divider ── */}
      <div style={{display:"flex",alignItems:"center",gap:14,margin:"4px 0 20px"}}>
        <div style={{fontSize:12,fontWeight:700,color:INK,whiteSpace:"nowrap",display:"flex",alignItems:"center"}}>Centre / feature stone?<InfoDot text="Price the main stone on your natural/lab stone markup by carat weight, rather than folding it into the jewellery costs."/></div>
        <div style={{flex:1,height:1,background:BD}}/>
      </div>

      {/* Stone mode — inline pill selector */}
      <div style={{display:"flex",gap:8,marginBottom:stoneMode==="none"?0:22}}>
        {[["none","No stone"],["client","Client supplying their own"],["sourcing","We are sourcing the stone"]].map(([val,label])=>(
          <button key={val} onClick={()=>{setStoneMode(val);if(val!=="sourcing")setStoneItems([]);if(val!=="sourcing")setStoneType("");}} style={{
            padding:"8px 20px",borderRadius:3,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            border:`1.5px solid ${stoneMode===val?(val==="sourcing"?"#96627C":val==="client"?"#4E8B6A":INK):BD}`,
            background:stoneMode===val?(val==="sourcing"?"#96627C22":val==="client"?"#4E8B6A22":"#1A1A1A11"):"transparent",
            color:stoneMode===val?(val==="sourcing"?"#96627C":val==="client"?"#4E8B6A":INK):WG,
            transition:"all 0.12s"
          }}>{label}</button>
        ))}
      </div>

      {/* Client's own stone */}
      {stoneMode==="client"&&<div style={{background:"#EDF5EF",border:"1px solid #C4DECB",borderRadius:4,padding:"14px 16px",marginBottom:4}}>
        <div style={{fontSize:12,color:"#2C5282",marginBottom:10,lineHeight:1.6}}>No stone cost will be added to this quote. Record the stone details below for your files.</div>
        <Input label="Stone description (for records)" value={stoneNotes} onChange={setStoneNotes} as="textarea" rows={2} placeholder="e.g. Client's own 1.52ct oval sapphire, untreated, GIA cert #12345. Supplied at client's risk."/>
      </div>}

      {/* Studio sourcing */}
      {stoneMode==="sourcing"&&<div>
        {/* Stone type selector */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Stone type</div>
          <div style={{display:"flex",gap:10}}>
            {[["natural","🌍  Natural Diamond / Gemstone","3.00× – 1.20×","#4E8B6A"],["lab","⚗️  Lab-Grown Diamond / Gemstone","4.25× – 1.20×","#96627C"]].map(([val,label,range,col])=>(
              <button key={val} onClick={()=>setStoneType(val)} style={{
                flex:1,padding:"12px 16px",borderRadius:4,cursor:"pointer",fontFamily:"inherit",textAlign:"left",
                border:`2px solid ${stoneType===val?col:BD}`,
                background:stoneType===val?col+"11":"transparent",transition:"all 0.12s"
              }}>
                <div style={{fontSize:12,fontWeight:700,color:stoneType===val?col:INK,marginBottom:3}}>{label}</div>
                <div style={{fontSize:10,color:stoneType===val?col:WG,letterSpacing:"0.02em"}}>{range} markup table</div>
              </button>
            ))}
          </div>
        </div>

        {/* Stone line entries live up in the unified Jewellery costs list (tagged CENTRE).
            Here we keep the type selector above, plus the pricing summary + notes below. */}
        {stoneType&&<>
          <div style={{fontSize:12,color:WG,marginBottom:12,lineHeight:1.5}}>Add the centre stone with <strong style={{color:stoneType==="lab"?"#96627C":"#4E8B6A"}}>+ Centre stone</strong> in the jewellery costs list above — it's tagged <strong>CENTRE</strong> and priced on the {stoneType==="lab"?"lab-grown":"natural"} stone markup below.</div>
          {stoneCalc&&<div style={{marginBottom:4}}>
            <div style={{fontSize:11,fontWeight:700,color:stoneType==="lab"?"#96627C":"#4E8B6A",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>
              {stoneType==="lab"?"Lab-Grown stone":"Natural stone"} — markup + {TAX_LABEL}
            </div>
            <StoneMarkupSummary calc={stoneCalc}/>
            {/* Manual stone-markup override — dial a pricey stone down, this quote only */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:700,color:WG}}>Stone markup multiplier</span>
              <div style={{position:"relative",width:120}}>
                <input type="number" value={stoneOverride} onChange={e=>setStoneOverride(e.target.value)} placeholder={`${stoneCalc.autoMult} auto`} min="0" step="0.05"
                  style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 22px 7px 10px",textAlign:"right",fontWeight:stoneOverride?700:400,borderColor:stoneOverride?GOLD:BD}}/>
                <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>×</span>
              </div>
              {stoneOverride
                ?<><span style={{fontSize:12,color:GOLD_D,fontWeight:700}}>Override on · table suggests {stoneCalc.autoMult}×</span>
                   <button onClick={()=>setStoneOverride("")} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>Reset to auto</button></>
                :<span style={{fontSize:12,color:WG}}>Blank = use the bracket ({stoneCalc.autoMult}×). Lower it for a pricey stone — this quote only.</span>}
            </div>
          </div>}
          <Input label="Stone notes (for records)" value={stoneNotes} onChange={setStoneNotes} as="textarea" rows={2} placeholder="e.g. Sourced from XYZ. GIA cert pending."/>
        </>}
        {!stoneType&&<div style={{color:WG,fontSize:13,fontStyle:"italic",marginBottom:8}}>Select a stone type above, then add the centre stone in the jewellery costs list.</div>}
      </div>}

      {/* ── Grand total ── */}
      {(validItems.length>0||manualOn)&&<div style={{borderTop:`1px solid ${BD}`,marginTop:24,paddingTop:20,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Quote total</div>
            <div style={{display:"flex",gap:0,borderRadius:4,overflow:"hidden",border:`1px solid ${BD}`}}>
              {[
                ...(validItems.length>0?[
                  ["Jewellery piece",(calc.bracket||calc.overridden)?fmtR(calc.finalLow):"—",GOLD,""],
                  ...(accentStoneTotal>0?[["Accent stones",fmtR(accentStoneTotal),"#96627C","+ "]]:[]),
                ]:[]),
                ...(stoneMode==="sourcing"&&stoneCalc?[["Stone",fmtR(stoneCalc.clientTotal),stoneType==="lab"?"#96627C":"#4E8B6A","+ "]]:
                   stoneMode==="client"?[["Stone","Client supplying",WG,"+ "]]:
                   []),
                ...(tradeInN>0?[["Gold trade-in credit",fmtR(tradeInN),DANGER,"− "]]:[]),
                [tradeInN>0?"Amount payable":(manualOn?"Total — manual price":"Total"),fmtR(payableTotal),OK,"= "],
              ].map(([label,val,col,prefix],i,arr)=>(
                <div key={label} style={{flex:1,padding:"12px 16px",background:i===arr.length-1?INK:PARCH,borderRight:i<arr.length-1?`1px solid ${BD}`:"none"}}>
                  <div style={{fontSize:10,fontWeight:700,color:i===arr.length-1?"rgba(255,255,255,0.5)":WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:col}}><span style={{opacity:0.5,fontSize:12}}>{prefix}</span>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>}

      {/* ── Gold trade-in credit ── */}
      <div style={{borderTop:`1px solid ${BD}`,marginTop:16,paddingTop:18,marginBottom:8}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em"}}>Gold trade-in credit</div>
            <div style={{fontSize:11,color:WG,marginTop:3,lineHeight:1.5}}>Trading in old gold? Enter the credit you're giving — it shows on the quote, proposal &amp; invoice as a deduction and reduces the balance. Enter it here <strong>instead of</strong> recording a trade-in payment.</div>
          </div>
          <div style={{position:"relative",width:150,flexShrink:0}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
            <input type="number" value={tradeInCredit} onChange={e=>setTradeInCredit(e.target.value)} placeholder="0.00" min="0" step="0.01"
              style={{...SS.inp,marginTop:0,fontSize:14,padding:"8px 10px 8px 24px",textAlign:"right",fontWeight:tradeInN>0?800:400,borderColor:tradeInN>0?DANGER:BD}}/>
          </div>
        </div>
        {tradeInN>0&&<div style={{marginTop:10}}>
          <Input label="Trade-in note (weight / purity / test — shown on the documents)" value={tradeInNote} onChange={setTradeInNote} placeholder="e.g. 14.2g 18ct yellow, X-ray tested"/>
        </div>}
      </div>

      {/* ── Manual quoted price — for verbal phone / in-person quotes ── */}
      <div style={{borderTop:`1px solid ${BD}`,marginTop:16,paddingTop:18,marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em"}}>Manual quoted price</div>
            <div style={{fontSize:11,color:WG,marginTop:3,lineHeight:1.5}}>Quoted verbally over the phone or in person? Enter the final price (inc {TAX_LABEL}) — it becomes the quote total everywhere, no line items needed.</div>
          </div>
          <div style={{position:"relative",width:150,flexShrink:0}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
            <input type="number" value={manualTotal} onChange={e=>setManualTotal(e.target.value)} placeholder="0.00" min="0" step="0.01"
              style={{...SS.inp,marginTop:0,fontSize:14,padding:"8px 10px 8px 24px",textAlign:"right",fontWeight:manualOn?800:400,borderColor:manualOn?OK:BD}}/>
          </div>
          {manualOn&&<><span style={{fontSize:12,color:OK,fontWeight:700}}>Manual price on{validItems.length>0||stoneCalc?` · calculated total is ${fmtR(grandTotal)}`:""}</span>
            <button onClick={()=>setManualTotal("")} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>Clear</button></>}
        </div>
      </div>

      {/* ── Internal notes ── */}
      <div style={{borderTop:`1px solid ${BD}`,marginTop:8,paddingTop:16,marginBottom:14}}>
        <div style={{marginBottom:14}}>
          <label style={{...SS.lbl,marginBottom:6}}>Internal notes <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(not visible to client)</span></label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="e.g. Price locked at approval. Metal prices current as of today." style={{...SS.inp,marginTop:0,resize:"vertical"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",alignItems:"center"}}>
        <Btn ghost onClick={()=>setView(stockMode?"stock":"jobDetail_"+jobId)}>Cancel</Btn>
        <Btn onClick={()=>save_(isEditing?existingQuote.status:"Draft")}>{stockMode?"Save price":isEditing?"Save changes":"Save quote"}</Btn>
      </div>
    </Card>

    {pricingModal&&<div onClick={e=>{if(e.target===e.currentTarget)closePricing();}}
      style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(3px)",padding:16}}>
      <div style={{background:WHITE,borderRadius:4,width:"min(1240px,97vw)",height:"min(880px,94vh)",display:"flex",flexDirection:"column",border:`1px solid ${BD}`,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",overflow:"hidden"}}>

        {/* ── Header: title + global search (fixed) ── */}
        <div style={{flexShrink:0,padding:"16px 24px 14px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:800,color:INK}}>Add from pricing DB</h2>
            <button onClick={closePricing} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:WG,lineHeight:1,padding:0}}>×</button>
          </div>
          <input autoFocus value={pSearch} onChange={e=>setPSearch(e.target.value)} placeholder="Search the whole pricing DB…  (Esc closes)" style={{...SS.inp,marginTop:0}}/>
          <div style={{marginTop:8,fontSize:11.5,color:WG,lineHeight:1.5}}>These are your cost prices, the mark-up is applied automatically by the multiplier table. The one exception is the repair prices that are already shown as a retail guide.</div>
        </div>

        {/* ── Body: category sidebar + item list (stacks on mobile) ── */}
        <div style={{flex:1,display:"flex",flexDirection:isMobile?"column":"row",minHeight:0}}>
          <div style={isMobile
            ?{flexShrink:0,borderBottom:`1px solid ${BD}`,overflowX:"auto",padding:"8px 10px",background:PARCH,display:"flex",gap:6}
            :{width:220,flexShrink:0,borderRight:`1px solid ${BD}`,overflowY:"auto",padding:"10px 8px",background:PARCH}}>
            {NAV_CATS.map(cat=>{
              const n=cat==="All"?pricing.filter(p=>p.category!=="Accent Stones").length:pricing.filter(p=>p.category===cat).length;
              const active=!pSearching&&pCat===cat;
              return <button key={cat} onClick={()=>{setPCat(cat);setSelCAD(null);setPSearch("");}}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,width:isMobile?"auto":"100%",flexShrink:isMobile?0:undefined,whiteSpace:isMobile?"nowrap":undefined,textAlign:"left",padding:"8px 12px",borderRadius:6,border:isMobile?`1px solid ${active?GOLD:BD}`:"none",background:active?GOLD:(isMobile?WHITE:"transparent"),color:active?WHITE:INK,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:isMobile?0:2}}>
                <span>{catTitle(cat)}</span>
                {n>0&&<span style={{fontSize:10,fontWeight:700,color:active?"rgba(255,255,255,0.75)":WG}}>{n}</span>}
              </button>;
            })}
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,padding:isMobile?"0 14px":"0 24px"}}>
            {/* Manual override price — available on every category (pinned above the list) */}
            <div style={{flexShrink:0,background:GOLD_L+"66",border:`1px solid ${GOLD}55`,borderRadius:4,padding:"11px 14px",margin:"12px 0 10px"}}>
              <div style={{fontSize:12,fontWeight:700,color:GOLD_D,marginBottom:2}}>Manual price{!pSearching&&pCat!=="All"?` (${catTitle(pCat)})`:""}</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.5,marginBottom:9}}>{pSearching?MANUAL_OVERRIDE_DEFAULT:manualOverrideText(pCat)}</div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <input value={manLabel} onChange={e=>setManLabel(e.target.value)} placeholder="Label" onKeyDown={e=>{if(e.key==="Enter")addManual();}} style={{...SS.inp,marginTop:0,flex:1,minWidth:200}}/>
                <div style={{position:"relative",width:120,flexShrink:0}}>
                  <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
                  <input type="number" value={manAmt} onChange={e=>setManAmt(e.target.value)} min="0" step="0.01" placeholder="0.00" onKeyDown={e=>{if(e.key==="Enter")addManual();}} style={{...SS.inp,marginTop:0,padding:"11px 10px 11px 22px",textAlign:"right",width:"100%"}}/>
                </div>
                <Btn sm onClick={addManual}>Add to quote</Btn>
              </div>
            </div>

            {!pSearching&&pCat===SETTING_CAT
              ? <div style={{flex:1,overflowY:"auto",paddingBottom:14}}><SettingPicker onAdd={addSetting} settingRates={centreRates} pricing={pricing}/></div>
              : <div style={{flex:1,overflowY:"auto",paddingBottom:14}}>
                  {(()=>{
                    const visibleItems=fp.filter(item=>item.category!=="Accent Stones");
                    const isRepairsView=!pSearching&&pCat===REPAIRS_CAT;
                    const showCat=pSearching||pCat==="All";
                    let lastGroup=null;let lastSubgroup=null;
                    return visibleItems.map(item=>{
                    const showGroupHeader=isRepairsView&&item.group&&item.group!==lastGroup;
                    if(showGroupHeader){lastGroup=item.group;lastSubgroup=null;}
                    const showSubgroupHeader=isRepairsView&&item.subgroup&&(item.subgroup!==lastSubgroup);
                    if(showSubgroupHeader)lastSubgroup=item.subgroup;
                    const isDiamond=DIAMOND_CATS.includes(item.category);
                    const isSetting=item.category==="Basic Setting"||item.category==="Complex Setting";
                    const isPrintCast=item.category==="3D Print & Cast";
                    const isFixedJob=item.unit==="job";
                    const needsQty=!isFixedJob;
                    const qty=pQty[item.id]||"";
                    const qtyStep=item.unit==="g"?"0.1":"1";
                    const qtyLabel=item.unit==="g"?"Grams":item.unit==="hr"?"Hours":item.unit==="pair"?"Pairs":item.unit==="item"?"Qty":isPrintCast?"Pieces":isDiamond||isSetting?"Stones":"Qty";
                    const previewCost=needsQty&&qty&&Number(qty)>0?(item.baseCost*Number(qty)).toFixed(2):null;
                    const mode=pMode[item.id]||(item.poa||item.baseCost===0&&item.unit==="stone"?"amt":"qty");
                    const amtMode=mode==="amt";
                    const addNow=()=>amtMode?addManualAmount(item,qty):addFromDB(item,qty||1);
                    const timesAdded=addedIds[item.id]||0;
                    const flashing=pFlash===item.id;
                    const row=<div key={item.id} style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",gap:isMobile?8:10,padding:"8px 0",borderBottom:`1px solid ${BD}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                          <span style={{fontWeight:600,fontSize:13,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:isMobile?"normal":"nowrap"}}>{(isDiamond||isSetting)?`${item.sizeMm}mm`:item.name}</span>
                          {timesAdded>0&&<span style={{background:flashing?OK:OK+"1A",color:flashing?WHITE:OK,fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:4,letterSpacing:"0.05em",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.25s"}}>✓ {timesAdded>1?`ON QUOTE ×${timesAdded}`:"ON QUOTE"}</span>}
                        </div>
                        <div style={{fontSize:11,color:WG,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:isMobile?"normal":"nowrap"}}>
                          {showCat?`${catTitle(item.category)} · `:""}
                          {isDiamond?`${item.caratWeight}ct · ${fmt(item.baseCost)}/stone · ${fmt(item.pricePerCarat)}/ct`
                          :isSetting?`stone fits ${item.caratWeight}ct · ${fmt(item.baseCost)}/stone setting`
                          :isPrintCast?`${fmt(item.baseCost)}/piece`
                          :`${fmt(item.baseCost)} per ${item.unit}`}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:isMobile?"nowrap":"wrap",justifyContent:isMobile?"flex-start":"flex-end",flexShrink:0}}>
                      {isFixedJob
                        ?<>
                          <span style={{fontSize:13,fontWeight:700,color:INK,whiteSpace:"nowrap"}}>{fmt(item.baseCost)}</span>
                          <Btn sm onClick={()=>addFromDB(item,1)}>Add</Btn>
                        </>
                        :needsQty&&<>
                          <div title={amtMode?"Typing your own price — click Qty to use the preset rate × quantity instead":"Using the preset rate × quantity — click $ Price to type your own price instead"}
                            style={{display:"flex",borderRadius:6,overflow:"hidden",border:`1px solid ${BD}`,flexShrink:0}}>
                            {[["qty","Qty"],["amt","$ Price"]].map(([m,lab])=>(
                              <button key={m} onClick={()=>setPMode(p=>({...p,[item.id]:m}))}
                                style={{padding:"4px 9px",border:"none",background:mode===m?INK:"transparent",color:mode===m?WHITE:WG,fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit",lineHeight:"16px",whiteSpace:"nowrap"}}>{lab}</button>
                            ))}
                          </div>
                          <input type="number" value={qty} min="0" step={amtMode?"0.01":qtyStep}
                            onChange={e=>setPQty(p=>({...p,[item.id]:e.target.value}))}
                            onKeyDown={e=>{if(e.key==="Enter")addNow();}}
                            placeholder={amtMode?"$ price":qtyLabel}
                            style={{...SS.inp,marginTop:0,width:isMobile?"auto":96,flex:isMobile?1:undefined,minWidth:0,padding:"6px 9px",fontSize:13,textAlign:"right",flexShrink:isMobile?1:0}}/>
                          <span style={{fontSize:12,fontWeight:800,color:OK,whiteSpace:"nowrap",width:isMobile?"auto":84,textAlign:"right",flexShrink:0}}>{amtMode?(Number(qty)>0?`= ${fmt(qty)}`:""):previewCost?`= ${fmt(previewCost)}`:""}</span>
                          <Btn sm onClick={addNow}>Add</Btn>
                        </>}
                      </div>
                    </div>;
                    const prefix=[];
                    if(showGroupHeader)prefix.push(<div key={item.id+"_g"} style={{padding:"10px 0 2px"}}><span style={{fontSize:10,fontWeight:800,color:GOLD_D,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.group}</span></div>);
                    if(showSubgroupHeader)prefix.push(<div key={item.id+"_sg"} style={{padding:"6px 0 1px",marginLeft:2}}><span style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.07em"}}>{item.subgroup}</span></div>);
                    if(!prefix.length)return row;
                    return [...prefix,row];
                  });
                  })()}
                  {fp.length===0&&<div style={{color:WG,fontSize:13,padding:"14px 0",lineHeight:1.6}}>{pSearching?"No matches for your search.":"No preset items in this category yet."}<br/><span style={{fontSize:12}}>That's fine — use the <strong style={{color:GOLD_D}}>Manual price</strong> box above to type a label and price, and add it straight to the quote.</span></div>}
                </div>
            }
          </div>
        </div>

        {/* ── Footer: session tally + live quote total + Done ── */}
        <div style={{flexShrink:0,borderTop:`1px solid ${BD}`,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,background:PARCH}}>
          <div style={{fontSize:12,color:WG}}>
            {sessionAdds.length>0
              ?<span><strong style={{color:OK}}>✓ {sessionAdds.length} item{sessionAdds.length!==1?"s":""} added</strong> · {fmt(sessionAdds.reduce((a,b)=>a+b,0))} cost this visit</span>
              :<span>The popup stays open — add as many items as you need, then hit Done.</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <span style={{fontSize:12,color:WG}}>Quote total: <strong style={{color:OK,fontSize:15}}>{fmtR(manualOn?Number(manualTotal):grandTotal)}</strong> inc {TAX_LABEL}</span>
            <Btn onClick={closePricing}>Done</Btn>
          </div>
        </div>
      </div>
    </div>}

    {accentModal&&<AccentStoneModal
      pricing={pricing} setPricing={setPricing} naturalStoneMarkup={natTable} labStoneMarkup={labTable}
      onAdd={item=>{setAccentItems(p=>[...p,{...item,id:uid(),accentStone:true,noMarkup:false,markupMode:item.markupMode||"mfg"}]);setAccentModal(false);}}
      onClose={()=>setAccentModal(false)}
    />}
    {centreModal&&<CentreStoneModal
      stoneType={stoneType} activeStoneMarkup={activeStoneMarkup} stoneOverride={stoneOverride}
      onAdd={item=>{setStoneItems(p=>[...p,{...item,id:uid()}]);setCentreModal(false);}}
      onClose={()=>setCentreModal(false)}
    />}
  </div>;
}

// ── Multi-option proposals (staff side) ───────────────────────────────────
// A proposal bundles several quotes as "options" for one job and produces a public
// link the client opens to pick one and accept online. See PublicProposalPage below.
function JobProposals({job,client,quotes,proposals,setProposals,setQuotes,biz,markupTable,payments=[],invoices=[]}){
  const jobProposals=(proposals||[]).filter(p=>p.jobId===job?.id).slice().reverse();
  const [builder,setBuilder]=useState(false);
  const [editingId,setEditingId]=useState(null);   // proposal being edited (null = creating a new one)
  const [sel,setSel]=useState([]);            // chosen option quote ids
  const [recommended,setRecommended]=useState("");
  const [intro,setIntro]=useState("");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState("");
  const [checking,setChecking]=useState("");
  const [expanded,setExpanded]=useState({});   // per-option: show its photos/video editor (default open)
  const isMobile=useIsMobile();
  const [selectMode,setSelectMode]=useState("single");   // "single" = pick one, "multi" = pick any (bundle)
  const [optPhotos,setOptPhotos]=useState({});            // quoteId → chosen job image path
  const [optVideos,setOptVideos]=useState({});            // quoteId → video URL (YouTube/Vimeo/Loom/direct)
  const [bulkVideos,setBulkVideos]=useState("");          // paste-many box: one link per line, assigned across options
  const [showBulk,setShowBulk]=useState(false);
  const [dueNow,setDueNow]=useState("");                  // optional custom "amount due now" (overrides full balance)
  const [dueNowTouched,setDueNowTouched]=useState(false); // true once the jeweller edits it — stops the 50% auto-fill
  const [payNote,setPayNote]=useState("");                // optional payment-terms note shown near the balance
  const [jobPhotos,setJobPhotos]=useState([]);            // job's uploaded images as {path,url,caption}
  const [preview,setPreview]=useState(null);              // {url,caption} shown full-size while choosing photos
  useEffect(()=>{
    let cancelled=false;
    (async()=>{const ph=await jobImagesForPrint(job,24);if(!cancelled)setJobPhotos(ph);})();
    return()=>{cancelled=true;};
  },[job?.id,(job?.images||[]).map(i=>i.path).join(",")]);   // eslint-disable-line

  // Only quotes with a resolvable price can be sent as options
  const optionable=(quotes||[]).filter(q=>{
    const calc=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
    return quoteIsManual(q)||!(calc.base>0&&!calc.bracket&&!calc.overridden);
  });
  const linkFor=p=>`${window.location.origin}/?p=${p.token}`;
  const save=next=>{setProposals(next);persist(K.pp,next);};
  // Used as the intro when the box is left blank (and shown as its placeholder), so the
  // greyed example is exactly what appears at the top of the proposal.
  const defaultIntro=`Dear ${client?.name||"there"}, thank you for your enquiry. Please find your options below.`;

  const toggle=id=>setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  // Combined inc-GST total of the ticked options — a bundle's full price (manual price wins per quote).
  const selectedTotal=optionable.filter(q=>sel.includes(q.id)).reduce((s,q)=>s+quoteGrandTotal(q,markupTable),0);
  // "Amount due now" left blank = the studio's deposit % applied to whatever the client actually
  // selects (worked out on the public page, so a bundle scales down when they pick fewer pieces).
  // A typed dollar figure overrides it with a fixed amount. We deliberately DON'T pre-fill a dollar
  // here: pre-filling the full-bundle deposit as a fixed number made the client page demand that
  // whole amount even when the client picked a smaller subset.
  const depositPct=Number(biz?.depositPercent)||50;
  // optPhotos[qid] is an array of chosen image paths — tap toggles a photo in/out of the option.
  const pickPhoto=(qid,path)=>setOptPhotos(p=>{const cur=p[qid]||[];return{...p,[qid]:cur.includes(path)?cur.filter(x=>x!==path):[...cur,path]};});
  const openBuilder=()=>{setEditingId(null);setSel([]);setRecommended("");setIntro("");setSelectMode("single");setOptPhotos({});setOptVideos({});setBulkVideos("");setShowBulk(false);setDueNow("");setDueNowTouched(false);setPayNote("");setBuilder(true);};
  // Reopen the composer pre-filled with an existing proposal so it can be edited (add/remove options,
  // add images or videos, change the intro/deposit) and re-published to the SAME client link.
  const openEditor=p=>{setEditingId(p.id);setSel(p.optionIds||[]);setRecommended(p.recommendedId||"");setIntro(p.intro===defaultIntro?"":(p.intro||""));setSelectMode(p.selectMode==="multi"?"multi":"single");setOptPhotos(p.optionPhotos||{});setOptVideos(p.optionVideos||{});setBulkVideos("");setShowBulk(false);setDueNow(p.dueNow!=null?String(p.dueNow):"");setDueNowTouched(p.dueNow!=null);setPayNote(p.paymentNote||"");setBuilder(true);};
  // Assign pasted links (one per line) to the ticked options, in display order.
  const applyBulkVideos=()=>{
    const links=bulkVideos.split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
    const ids=optionable.filter(q=>sel.includes(q.id)).map(q=>q.id);
    if(!ids.length)return alert("Tick the options you want first, then paste the links in the same order.");
    if(!links.length)return;
    setOptVideos(p=>{const n={...p};ids.forEach((id,i)=>{if(links[i])n[id]=links[i];});return n;});
    setShowBulk(false);setBulkVideos("");
  };

  const createAndShare=async()=>{
    if(!sel.length)return alert("Pick at least one quote to include as an option.");
    if(!supabaseEnabled)return alert("Online proposals need the cloud — you appear to be in local-only mode.");
    setBusy(true);
    const orderedIds=optionable.filter(q=>sel.includes(q.id)).map(q=>q.id);
    const optionPhotos={};orderedIds.forEach(qid=>{const arr=optPhotos[qid];if(arr&&arr.length)optionPhotos[qid]=arr;});
    const optionVideos={};orderedIds.forEach(qid=>{const v=(optVideos[qid]||"").trim();if(v)optionVideos[qid]=v;});
    const fields={optionIds:orderedIds,optionPhotos,optionVideos,recommendedId:selectMode==="multi"?"":(recommended||""),selectMode,intro:intro.trim()||defaultIntro,dueNow:Number(dueNow)>0?+(+dueNow).toFixed(2):null,paymentNote:payNote.trim()};
    const photoMap=await jobImageMap(job);
    if(editingId){
      // Edit an existing proposal: keep its id/token/status, update the fields, re-publish to the same link.
      const existing=proposals.find(x=>x.id===editingId);
      if(!existing){setBusy(false);setEditingId(null);setBuilder(false);return;}
      const proposal={...existing,...fields};
      proposal.syncState=proposalState(proposal);   // baseline for "Update from quote" differs-detection
      const snapshot=buildProposalSnapshot({proposal,job,client,biz,quotes,markupTable,payments,photoMap});
      const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snapshot}).eq("token",proposal.token);
      setBusy(false);
      if(error){alert("Couldn't update the proposal: "+error.message);return;}
      save(proposals.map(x=>x.id===editingId?proposal:x));
      setBuilder(false);setEditingId(null);
      copyLink(proposal);
      return;
    }
    const id=uid(),token=proposalToken();
    const proposal={id,jobId:job.id,token,...fields,createdAt:today(),status:"sent",acceptedQuoteId:null,acceptedName:"",acceptedAt:null};
    proposal.syncState=proposalState(proposal);   // baseline for "Update from quote" differs-detection
    const snapshot=buildProposalSnapshot({proposal,job,client,biz,quotes,markupTable,payments,photoMap});
    const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).insert({token,studio_id:_studioId,data:snapshot,status:"sent",created_at:new Date().toISOString()});
    setBusy(false);
    if(error){alert("Couldn't publish the proposal: "+error.message+"\n\nIf this mentions a missing table, the one-time Supabase setup hasn't been run yet.");return;}
    save([...proposals,proposal]);
    setBuilder(false);
    // surface the link immediately
    copyLink(proposal);
  };

  const copyLink=p=>{navigator.clipboard?.writeText(linkFor(p)).catch(()=>{});setCopied(p.id);setTimeout(()=>setCopied(c=>c===p.id?"":c),2000);};

  // Pull acceptance status back from the cloud and reflect it locally (+ approve the chosen quote)
  const checkAcceptance=async(p,silent)=>{
    if(!supabaseEnabled)return;
    if(!silent)setChecking(p.id);
    const{data,error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).select("status,accepted_option,accepted_name,accepted_at").eq("token",p.token).maybeSingle();
    if(!silent)setChecking("");
    if(error||!data)return;
    if(data.status==="accepted"&&p.status!=="accepted"){
      const acceptedQuoteId=data.accepted_option;
      setProposals(prev=>{const n=prev.map(x=>x.id===p.id?{...x,status:"accepted",acceptedQuoteId,acceptedName:data.accepted_name||"",acceptedAt:data.accepted_at||today()}:x);persist(K.pp,n);return n;});
      // Same safeguard as reconcileAccept: never demote an invoiced quote.
      setQuotes(prev=>{const n=prev.map(q=>q.id===acceptedQuoteId?{...q,status:"Approved"}:(q.jobId===job.id&&q.status==="Approved"&&!quoteHasInvoice(invoices,q.id)?{...q,status:"Declined"}:q));persist(K.qu,n);return n;});
    }else if(!silent&&data.status!=="accepted"){
      alert("No acceptance yet — the client hasn't accepted this proposal.");
    }
  };

  // Auto-check sent proposals for acceptance when the job is opened
  useEffect(()=>{jobProposals.filter(p=>p.status==="sent").forEach(p=>checkAcceptance(p,true));},[job?.id]);   // eslint-disable-line
  // Keep sent proposals' link snapshots current (e.g. payments recorded since publishing) when the job opens
  useEffect(()=>{
    if(!supabaseEnabled||!supabase)return;
    const live=jobProposals.filter(p=>p.token&&p.status==="sent");
    if(!live.length)return;
    (async()=>{
      const photoMap=await jobImageMap(job);
      live.forEach(p=>{
        const snap=buildProposalSnapshot({proposal:p,job,client,biz,quotes,markupTable,payments,photoMap});
        supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",p.token).then(()=>{}).catch(()=>{});
      });
    })();
  },[job?.id]);   // eslint-disable-line

  const delProposal=async p=>{
    if(!confirm("Delete this proposal? The client's link will stop working."))return;
    if(supabaseEnabled)try{await supabase.from(PUBLIC_PROPOSALS_TABLE).delete().eq("token",p.token);}catch(e){}
    save(proposals.filter(x=>x.id!==p.id));
  };
  const[resent,setResent]=useState("");
  const[resentMsg,setResentMsg]=useState("");
  // A compact "money state" of a proposal (per-option price + trade-in, in cents, and total payments
  // received) captured each time we publish/refresh its link. Comparing the current state to this
  // baseline tells us whether "Update from quote" would actually change what the client sees.
  const proposalState=pp=>{
    const opts={};
    (pp.optionIds||[]).forEach(id=>{const q=quotes.find(x=>x.id===id);opts[id]={t:q?Math.round(quoteGrandTotal(q,markupTable)*100):null,ti:q?Math.round((Number(q.tradeInCredit)||0)*100):0};});
    const paid=Math.round((payments||[]).filter(pm=>pm.jobId===pp.jobId&&pm.status==="Received").reduce((s,pm)=>s+Number(pm.amount),0)*100);
    return{opts,paid};
  };
  const proposalChanges=pp=>{
    const base=pp.syncState;if(!base)return[];
    const cur=proposalState(pp),ids=pp.optionIds||[],out=[];
    if(ids.some(id=>(cur.opts[id]?.t)!==(base.opts?.[id]?.t)))out.push("prices");
    if(ids.some(id=>(cur.opts[id]?.ti)!==(base.opts?.[id]?.ti)))out.push("trade-in");
    if(cur.paid!==base.paid)out.push(cur.paid>base.paid?"new payment":"payments");
    return out;
  };
  // No baseline yet (proposals sent before this was added) → treat as "may differ" so the button stays usable.
  const proposalDiffers=pp=>!pp.syncState||proposalChanges(pp).length>0;
  // Rebuild the client's live link from the CURRENT quotes & payments (prices, trade-in, balance).
  const resendProposal=async p=>{
    if(!supabaseEnabled||!supabase||!p.token)return;
    const changes=proposalChanges(p);   // work out what changed BEFORE we reset the baseline
    try{
      const photoMap=await jobImageMap(job);
      const snap=buildProposalSnapshot({proposal:p,job,client,biz,quotes,markupTable,payments,photoMap});
      const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",p.token);
      if(error){alert("Couldn't update the proposal link: "+error.message);return;}
      const msg=changes.length?("✓ Updated: "+changes.join(", ")):(p.syncState?"✓ Already up to date":"✓ Link refreshed");
      setResent(p.id);setResentMsg(msg);setTimeout(()=>setResent(c=>c===p.id?"":c),2800);
      save(proposals.map(x=>x.id===p.id?{...x,syncState:proposalState(p)}:x));
    }catch(e){alert("Couldn't update the proposal link.");}
  };

  const optLabel=ids=>String(ids||"").split(",").map(s=>s.trim()).filter(Boolean).map(id=>{const q=quotes.find(x=>x.id===id);return q?quoteLabel(q):"—";}).join(" + ")||"—";

  return <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:jobProposals.length?14:0}}>
      <div>
        <div style={{fontWeight:700,fontSize:15,color:INK}}>Online proposals ({jobProposals.length})</div>
        <div style={{fontSize:12,color:WG,marginTop:2}}>Send the client a link with one or more price options they can accept online.</div>
      </div>
      <Btn sm onClick={openBuilder} disabled={optionable.length===0}>+ New proposal</Btn>
    </div>
    {optionable.length===0&&jobProposals.length===0&&<div style={{fontSize:13,color:WG,fontStyle:"italic",marginTop:10}}>Create a quote first — proposals are built from quotes.</div>}

    {jobProposals.map(p=>{
      const accepted=p.status==="accepted";
      return <div key={p.id} style={{border:`1px solid ${accepted?OK+"66":BD}`,borderRadius:4,padding:"12px 14px",marginBottom:10,background:accepted?OK+"08":WHITE}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontWeight:700,fontSize:14,color:INK}}>{(p.optionIds||[]).length} option{(p.optionIds||[]).length!==1?"s":""}</span>
              <Badge label={accepted?"Accepted":p.status==="sent"?"Sent":"Draft"} color={accepted?OK:p.status==="sent"?GOLD_D:WG}/>
              <span style={{fontSize:12,color:WG}}>{fmtDate(p.createdAt)}</span>
            </div>
            <div style={{fontSize:12,color:WG,marginTop:4}}>{(p.optionIds||[]).map(optLabel).join(" · ")}</div>
            {accepted&&<div style={{fontSize:13,color:OK,fontWeight:700,marginTop:6}}>✓ {p.acceptedName||"Client"} accepted “{optLabel(p.acceptedQuoteId)}”{p.acceptedAt?` on ${fmtDate(p.acceptedAt)}`:""} — quote approved.</div>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>copyLink(p)} style={{background:copied===p.id?OK:GOLD_L,border:`1px solid ${copied===p.id?OK:GOLD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:copied===p.id?WHITE:GOLD_D,cursor:"pointer",fontFamily:"inherit"}}>{copied===p.id?"✓ Copied":"Copy link"}</button>
            <EmailClientButton to={client?.email} clientName={clientDisplayName(client)} biz={biz} linkUrl={linkFor(p)} docType="proposal" defaultSubject={`Your proposal from ${biz?.name||"us"}`} defaultMessage={`Thank you for considering ${biz?.name||"us"} for your piece. Please review your proposal using the button below — you can accept your preferred option online.`}/>
            <button onClick={()=>window.open(linkFor(p),"_blank")} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>Preview</button>
            {(()=>{const differs=proposalDiffers(p),showMsg=resent===p.id;
              return <button onClick={()=>resendProposal(p)} title={differs?"Push the latest quote prices & payments to the client's link":"The client's link already matches the current quote"}
                style={{background:showMsg?OK:"none",border:`1px solid ${showMsg?OK:differs?GOLD:BD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:showMsg?WHITE:differs?GOLD_D:WG,cursor:"pointer",fontFamily:"inherit",opacity:showMsg||differs?1:0.7}}>
                {showMsg?resentMsg:differs?"↻ Update from quote":"✓ Matches quote"}</button>;})()}
            {!accepted&&<button onClick={()=>openEditor(p)} title="Edit this proposal — add options, images or change the intro; keeps the same link" style={{background:"none",border:`1px solid ${GOLD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:GOLD_D,cursor:"pointer",fontFamily:"inherit"}}>✎ Edit</button>}
            {!accepted&&<button onClick={()=>checkAcceptance(p,false)} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>{checking===p.id?"Checking…":"Check for acceptance"}</button>}
            <button onClick={()=>delProposal(p)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:17,padding:0,lineHeight:1}}>×</button>
          </div>
        </div>
      </div>;
    })}

    {builder&&<Modal title={editingId?"Edit proposal":"New proposal"} onClose={()=>{setBuilder(false);setEditingId(null);}} wide
      footer={<div style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{marginRight:"auto",minWidth:0}}>
          <div style={{fontSize:12.5,fontWeight:700,color:INK}}>{sel.length} option{sel.length!==1?"s":""} selected</div>
          {selectMode==="multi"&&selectedTotal>0&&<div style={{fontSize:11,color:WG,marginTop:1}}>Combined {fmtR(selectedTotal)} inc {TAX_LABEL} · {Number(dueNow)>0?`${fmtR(Number(dueNow))} due now`:`${fmtR(selectedTotal*depositPct/100)} deposit (${depositPct}%)`}</div>}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
          <Btn ghost onClick={()=>{setBuilder(false);setEditingId(null);}}>Cancel</Btn>
          <Btn onClick={createAndShare} disabled={busy||!sel.length}>{busy?(editingId?"Updating…":"Publishing…"):(editingId?(isMobile?"Update":"Update proposal"):(isMobile?"Publish":"Publish & copy link"))}</Btn>
        </div>
      </div>}>
      <div style={{fontSize:13,color:WG,marginBottom:16,lineHeight:1.6}}>Pick the quote(s) to offer as options, then choose how the client selects.</div>
      {/* How the client chooses */}
      <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:9}}>How the client chooses</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:22}}>
        {[["single","Choose one","The client picks a single option. Great for alternatives like Good, Better, Best."],["multi","Choose any (bundle)","The client can tick more than one, for sets they buy together (e.g. two wedding bands). Total is the chosen options combined."]].map(([m,t,d])=>{
          const active=selectMode===m;
          return <button key={m} onClick={()=>setSelectMode(m)} style={{textAlign:"left",padding:"15px 16px",borderRadius:12,border:`1.5px solid ${active?GOLD:BD}`,background:active?GOLD_L:WHITE,cursor:"pointer",fontFamily:"inherit",display:"flex",gap:12,alignItems:"flex-start",boxShadow:active?`0 0 0 3px ${GOLD_L}`:"0 1px 2px rgba(0,0,0,0.03)",transition:"border-color 0.15s, box-shadow 0.15s, background 0.15s"}}>
            <span style={{flexShrink:0,marginTop:1,width:18,height:18,borderRadius:"50%",border:`2px solid ${active?GOLD:"#CFC5BB"}`,background:WHITE,display:"flex",alignItems:"center",justifyContent:"center"}}>{active&&<span style={{width:9,height:9,borderRadius:"50%",background:GOLD}}/>}</span>
            <span style={{minWidth:0}}>
              <span style={{display:"block",fontSize:13.5,fontWeight:700,color:active?GOLD_D:INK,marginBottom:3}}>{t}</span>
              <span style={{display:"block",fontSize:11.5,color:WG,lineHeight:1.5}}>{d}</span>
            </span>
          </button>;
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8,flexWrap:"wrap"}}>
        <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",display:"inline-flex",alignItems:"center"}}>Options<InfoDot text="Tick the quotes to offer the client. In 'Choose one' mode you can mark one as ★ Recommended. Each ticked option can carry its own photos and a video link."/></div>
        {!showBulk&&<button onClick={()=>setShowBulk(true)} style={{background:"none",border:"none",cursor:"pointer",color:GOLD_D,fontSize:12,fontWeight:700,fontFamily:"inherit",padding:0}}>＋ Paste multiple video links</button>}
      </div>
      {showBulk&&<div style={{border:`1px solid ${BD}`,borderRadius:10,padding:"12px 14px",background:PARCH,marginBottom:10}}>
        <div style={{fontSize:11,color:WG,lineHeight:1.5,marginBottom:8}}>Tick your options below first, then paste one video link per line — they fill your ticked options top to bottom (you can still adjust any individually after).</div>
        <textarea value={bulkVideos} onChange={e=>setBulkVideos(e.target.value)} rows={4} placeholder={"https://youtu.be/aaa\nhttps://vimeo.com/123\nhttps://www.loom.com/share/…"} style={{...SS.inp,marginTop:0,resize:"vertical",fontSize:13,lineHeight:1.6}}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn sm ghost onClick={()=>{setShowBulk(false);setBulkVideos("");}}>Cancel</Btn>
          <Btn sm onClick={applyBulkVideos}>Assign to ticked options</Btn>
        </div>
      </div>}
      {optionable.map(q=>{
        const on=sel.includes(q.id);
        return <div key={q.id} style={{padding:"11px 13px",border:`1.5px solid ${on?GOLD:BD}`,borderRadius:10,marginBottom:9,background:on?GOLD_L+"55":WHITE,boxShadow:on?`0 0 0 3px ${GOLD_L}55`:"0 1px 2px rgba(0,0,0,0.03)",transition:"border-color 0.15s, box-shadow 0.15s"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <input type="checkbox" checked={on} onChange={()=>toggle(q.id)} style={{width:16,height:16,cursor:"pointer",accentColor:GOLD}}/>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>toggle(q.id)}>
              <div style={{fontWeight:700,fontSize:14,color:INK}}>{quoteLabel(q)}</div>
              <div style={{fontSize:12,color:WG,marginTop:1}}>{fmtR(quoteGrandTotal(q,markupTable))} inc {TAX_LABEL} · {q.status}</div>
            </div>
            {selectMode!=="multi"&&<button onClick={()=>setRecommended(r=>r===q.id?"":q.id)} disabled={!on}
              title="Mark as recommended"
              style={{background:recommended===q.id?GOLD:"none",border:`1px solid ${recommended===q.id?GOLD:BD}`,borderRadius:6,padding:"5px 11px",fontSize:12,fontWeight:700,color:recommended===q.id?WHITE:(on?GOLD_D:WG),cursor:on?"pointer":"not-allowed",fontFamily:"inherit",opacity:on?1:0.5}}>★ Recommend</button>}
          </div>
          {on&&(()=>{const isExp=expanded[q.id]!==false;const pc=(optPhotos[q.id]||[]).length;const hv=(optVideos[q.id]||"").trim();
          return <div style={{marginTop:10,paddingLeft:28}}>
            <button onClick={()=>setExpanded(e=>({...e,[q.id]:!isExp}))} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:7,color:GOLD_D,fontSize:11,fontWeight:700}}>
              <span style={{fontSize:9,color:WG}}>{isExp?"▾":"▸"}</span>Photos &amp; video<span style={{color:WG,fontWeight:400}}>{pc?` · ${pc} photo${pc!==1?"s":""}`:" · none yet"}{hv?" · video linked":""}</span>
            </button>
            {isExp&&<div style={{marginTop:10}}>
            {jobPhotos.length===0
              ?<div style={{fontSize:11,color:WG,fontStyle:"italic"}}>Upload images to this job to show a photo with this option.</div>
              :<>
                <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Photos for this option <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(tap to select · 🔍 to view full size{(optPhotos[q.id]||[]).length?` · ${(optPhotos[q.id]||[]).length} selected`:""})</span></div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {jobPhotos.map((ph,idx)=>{
                    const order=(optPhotos[q.id]||[]).indexOf(ph.path);
                    const picked=order>=0;
                    return <div key={ph.path} style={{width:96}}>
                      <button onClick={()=>pickPhoto(q.id,ph.path)} title={picked?`Position ${order+1} — tap to remove`:"Tap to use this photo"}
                        style={{position:"relative",width:"100%",padding:0,border:`2px solid ${picked?GOLD:BD}`,borderRadius:6,overflow:"hidden",cursor:"pointer",background:"none",lineHeight:0,boxShadow:picked?`0 0 0 2px ${GOLD_L}`:"none",display:"block"}}>
                        <img src={ph.url} alt={ph.caption||""} style={{width:"100%",height:96,objectFit:"cover",display:"block"}}/>
                        {picked&&<span style={{position:"absolute",top:4,left:4,minWidth:18,height:18,padding:"0 4px",boxSizing:"border-box",background:GOLD,color:WHITE,fontSize:11,fontWeight:800,lineHeight:"18px",textAlign:"center",borderRadius:9,boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}>{order+1}</span>}
                        <span onClick={e=>{e.stopPropagation();setPreview(ph);}} title="View full size" style={{position:"absolute",bottom:4,right:4,width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,0.6)",color:WHITE,fontSize:12,lineHeight:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-in"}}>🔍</span>
                      </button>
                      <div style={{fontSize:10,color:WG,marginTop:4,lineHeight:1.3,wordBreak:"break-word"}}>{ph.name
                        ?<><span style={{color:INK,fontWeight:600}}>{ph.name}</span>{(ph.caption||"").trim()?<span> · {ph.caption}</span>:""}</>
                        :((ph.caption||"").trim()||<span style={{fontStyle:"italic",opacity:0.7}}>Photo {idx+1}</span>)}</div>
                    </div>;
                  })}
                </div>
              </>}
            <div style={{marginTop:jobPhotos.length?14:0}}>
              <label style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Video for this option <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional — paste a YouTube, Vimeo, Loom or direct video link)</span></label>
              <input value={optVideos[q.id]||""} onChange={e=>setOptVideos(p=>({...p,[q.id]:e.target.value}))} placeholder="https://youtu.be/…" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px"}}/>
            </div>
            </div>}
          </div>;})()}
        </div>;
      })}
      <div style={{marginTop:14}}>
        <label style={{...SS.lbl,marginBottom:6}}>Intro message <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(optional — shown at the top of the proposal)</span></label>
        <textarea value={intro} onChange={e=>setIntro(e.target.value)} rows={3} placeholder={defaultIntro} style={{...SS.inp,marginTop:0,resize:"vertical",lineHeight:1.6}}/>
        <div style={{fontSize:11,color:WG,marginTop:5}}>Leave blank and this greyed message is added automatically.</div>
      </div>
      <div style={{marginTop:16,border:`1px solid ${BD}`,borderRadius:10,padding:"15px 17px",background:PARCH}}>
        <label style={{...SS.lbl,marginBottom:6}}>Payment terms <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
        <div style={{fontSize:11,color:WG,lineHeight:1.5,marginBottom:10}}>Leave "Amount due now" blank and each client is asked your {depositPct}% deposit of whatever they choose — for a bundle that scales to the pieces they actually pick. Enter a dollar figure to request a specific amount instead. The rest shows as due on completion.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Input label={<>Amount due now ({CUR_SYM})<InfoDot text="The deposit to request up front. Leave blank and the client's page asks your Settings deposit % of whatever they select — a bundle scales to the pieces they actually pick. Enter a dollar amount to request exactly that instead."/></>} value={dueNow} onChange={v=>{setDueNowTouched(true);setDueNow(v);}} type="number" min="0" step="0.01" placeholder={`Blank = ${depositPct}% of what they pick`}/>
          <Input label="Payment note" value={payNote} onChange={setPayNote} placeholder="e.g. Remaining 50% of the centre diamond"/>
        </div>
        {!(Number(dueNow)>0)&&selectedTotal>0&&<div style={{fontSize:11,color:WG,marginTop:8}}>If they choose {selectMode==="multi"?"all the pieces":"this option"}, that deposit is {fmtR(selectedTotal*depositPct/100)} ({depositPct}% of {fmtR(selectedTotal)}). A smaller selection is scaled down automatically.</div>}
      </div>
    </Modal>}
    {preview&&<div onClick={()=>setPreview(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:700,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:"30px 16px",cursor:"zoom-out"}}>
      <button onClick={e=>{e.stopPropagation();setPreview(null);}} aria-label="Close image" style={{position:"fixed",top:14,right:14,width:46,height:46,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.5)",color:WHITE,fontSize:26,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:701}}>×</button>
      <img src={preview.url} alt="" style={{maxWidth:"100%",maxHeight:"82vh",borderRadius:6,boxShadow:"0 20px 80px rgba(0,0,0,0.6)"}}/>
      <div style={{color:"rgba(255,255,255,0.85)",fontSize:13,textAlign:"center",maxWidth:680}}>{(preview.caption||"").trim()||"Tap the image or ✕ to close"}</div>
    </div>}
  </Card>;
}

// Client-facing repair receipt (rendered inside PublicProposalPage when kind==="repair").
// responded/decision/responderName reflect a prior accept/decline; onRespond records a new one.
function PublicRepairBody({snap,responded,decision,responderName,onRespond}){
  const b=snap.biz||{};
  const items=snap.items||[];
  const hasPrices=(snap.total||0)>0;
  const dash=<span style={{color:"#bbb"}}>—</span>;
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [photo,setPhoto]=useState(null);
  const respond=async(d)=>{
    if(!name.trim())return;
    setBusy(true);
    try{await onRespond(d,name.trim());}
    catch(e){alert("Sorry — we couldn't record your response. Please try again or contact the studio.");}
    setBusy(false);
  };
  const sum=[
    ["Client",snap.clientName||"—"],
    ["Taken in",snap.dateIn?fmtDate(snap.dateIn):"—"],
    ["Ready for collection",snap.dateOut?fmtDate(snap.dateOut):"—"],
    ...(hasPrices?[[`Repair total · inc ${TAX_LABEL}`,fmtR(snap.total)]]:[]),
  ];
  const accepted=responded&&decision!=="declined";
  return <div style={{maxWidth:760,margin:"0 auto"}}>
    {/* Header */}
    <div style={{background:INK,borderRadius:`${RADIUS}px ${RADIUS}px 0 0`,padding:"36px 44px 32px",color:WHITE,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:14}}>Repair Receipt</div>
        {b.logo
          ?<div style={{background:WHITE,borderRadius:4,padding:"8px 14px",display:"inline-block"}}><img src={b.logo} alt={b.name||"Logo"} style={{maxWidth:200,maxHeight:58,objectFit:"contain",display:"block"}}/></div>
          :<div style={{fontSize:26,fontWeight:800}}>{b.name||"Our Studio"}</div>}
        <div style={{marginTop:14,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.8}}>
          {b.address&&<div>{b.address}</div>}
          {(b.phone||b.email)&&<div>{[b.phone,b.email].filter(Boolean).join("  ·  ")}</div>}
          {b.abn&&<div style={{color:"rgba(255,255,255,0.32)"}}>{TAX_ID_LABEL} {b.abn}</div>}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:19,fontWeight:800,letterSpacing:"0.04em"}}>#{snap.ref}</div>
      </div>
    </div>

    <div style={{background:WHITE,borderRadius:`0 0 ${RADIUS}px ${RADIUS}px`,border:`1px solid ${BD}`,borderTop:"none",padding:"32px 44px 38px",boxShadow:SHADOW}}>
      {/* Summary strip */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${sum.length},1fr)`,gap:1,background:BD,border:`1px solid ${BD}`,borderRadius:4,overflow:"hidden",marginBottom:28}}>
        {sum.map(([l,v],i)=>(
          <div key={l} style={{background:WHITE,padding:"15px 18px"}}>
            <div style={{fontSize:9,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{l}</div>
            <div style={{fontSize:15,fontWeight:700,color:i===sum.length-1&&hasPrices?GOLD_D:INK}}>{v}</div>
          </div>
        ))}
      </div>

      {items.length>1&&<div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>{items.length} items received in this drop-off</div>}

      {/* Items */}
      <div style={{display:"grid",gridTemplateColumns:`30px 1.1fr 1.4fr 1fr${hasPrices?" 96px":""}`,gap:10,padding:"0 0 10px",borderBottom:`2px solid ${INK}`}}>
        {["#","Item","Issue / work","Condition",...(hasPrices?["Price"]:[])].map((h,i)=><div key={h} style={{fontSize:9,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:hasPrices&&i===4?"right":"left"}}>{h}</div>)}
      </div>
      {items.map((it,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:`30px 1.1fr 1.4fr 1fr${hasPrices?" 96px":""}`,gap:10,padding:"15px 0",borderBottom:`1px solid ${BD}`,fontSize:13.5,alignItems:"start"}}>
          <div style={{color:GOLD_D,fontWeight:800}}>{i+1}</div>
          <div style={{fontWeight:700,color:INK}}>{it.itemType||dash}</div>
          <div style={{color:"#444",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{it.damage||dash}</div>
          <div style={{color:"#444",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{it.condition||dash}</div>
          {hasPrices&&<div style={{fontWeight:700,color:INK,textAlign:"right"}}>{it.price>0?fmtR(it.price):dash}</div>}
        </div>
      ))}
      {hasPrices&&(()=>{
        const ti=Number(snap.tradeIn)||0,due=Math.max(0,(Number(snap.total)||0)-ti);
        return <div style={{marginTop:18,marginLeft:"auto",maxWidth:340}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:16,padding:"3px 0"}}>
            <span style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em"}}>Repair total (inc {TAX_LABEL})</span>
            <span style={{fontSize:ti>0?15:22,fontWeight:800,color:INK}}>{fmtR(snap.total)}</span>
          </div>
          {ti>0&&<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:16,padding:"3px 0",color:OK}}>
              <span style={{fontSize:12}}>Gold trade-in credit{snap.tradeInNote?` · ${snap.tradeInNote}`:""}</span>
              <span style={{fontSize:14,fontWeight:700}}>−{fmtR(ti)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:16,borderTop:`2px solid ${INK}`,marginTop:6,paddingTop:8}}>
              <span style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.06em"}}>Amount due</span>
              <span style={{fontSize:22,fontWeight:800,color:INK}}>{fmtR(due)}</span>
            </div>
          </>}
        </div>;
      })()}

      {snap.instructions&&<div style={{fontSize:13,color:INK,lineHeight:1.7,background:PARCH,borderLeft:`3px solid ${GOLD}`,borderRadius:"0 8px 8px 0",padding:"14px 18px",margin:"26px 0 0"}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Client instructions</div>{snap.instructions}
      </div>}

      {/* Uploaded photos of the piece(s) */}
      {(snap.photos||[]).length>0&&<div style={{margin:"28px 0 0"}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Photos on intake</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
          {snap.photos.map((p,i)=>(
            <figure key={i} style={{margin:0}}>
              <img src={p.url} alt={p.caption||"Repair photo"} onClick={()=>setPhoto(p.url)}
                style={{width:"100%",height:140,objectFit:"cover",borderRadius:6,border:`1px solid ${BD}`,display:"block",cursor:"zoom-in"}}/>
              {p.caption&&<figcaption style={{fontSize:11,color:WG,marginTop:5,lineHeight:1.4}}>{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </div>}

      {/* Confirm / decline */}
      {responded
        ?<div style={{background:(accepted?OK:DANGER)+"12",border:`1px solid ${(accepted?OK:DANGER)}55`,borderRadius:5,padding:"18px 20px",margin:"28px 0 4px"}}>
          <div style={{fontSize:15,fontWeight:800,color:accepted?OK:DANGER,marginBottom:3}}>{accepted?"✓ Repair confirmed":"Repair declined"}</div>
          <div style={{fontSize:13,color:INK,lineHeight:1.6}}>{accepted
            ?<>Thank you, {responderName||"and"} — you've authorised this repair to proceed. The studio has been notified.</>
            :<>You've declined this repair{responderName?` (${responderName})`:""}. Nothing further will happen — please contact the studio to discuss.</>}</div>
        </div>
        :<div style={{borderTop:`1px solid ${BD}`,marginTop:28,paddingTop:22}}>
          <div style={{fontSize:14,fontWeight:700,color:INK,marginBottom:4}}>Confirm this repair</div>
          <div style={{fontSize:12,color:WG,marginBottom:12,lineHeight:1.5}}>Please confirm you authorise the work described above, on the terms below.</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Type your full name" style={{...SS.inp,marginTop:0,marginBottom:12}}/>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={()=>respond("accepted")} disabled={!name.trim()||busy}
              style={{flex:1,minWidth:160,background:(!name.trim()||busy)?BD:INK,color:WHITE,border:"none",borderRadius:4,padding:"14px",fontSize:15,fontWeight:800,cursor:(!name.trim()||busy)?"not-allowed":"pointer",fontFamily:"inherit"}}>{busy?"Submitting…":"✓ Accept repair"}</button>
            <button onClick={()=>respond("declined")} disabled={!name.trim()||busy}
              style={{background:"none",color:DANGER,border:`1px solid ${DANGER}66`,borderRadius:4,padding:"14px 20px",fontSize:14,fontWeight:700,cursor:(!name.trim()||busy)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(!name.trim()||busy)?0.5:1}}>Decline</button>
          </div>
        </div>}

      {/* Terms */}
      <div style={{borderTop:`1px solid ${BD}`,marginTop:26,paddingTop:20}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>Terms &amp; conditions</div>
        <div style={{fontSize:11,color:"#7A746E",lineHeight:1.7}}>
          <strong style={{color:INK}}>Gemstone &amp; diamond setting:</strong> For client-supplied gemstones or diamonds we have not crafted or sourced, we cannot assume responsibility for any damage that may occur during setting or repair. The quality, integrity and condition of externally sourced stones are solely the client's responsibility. By submitting such items you accept that we cannot be held liable for any damage incurred.<br/><br/>
          <strong style={{color:INK}}>Repair warranty:</strong> {b.name||"We"} carry out repairs with the utmost care and craftsmanship, but do not provide a warranty on repaired pieces. The nature of jewellery repair means we cannot guarantee against further damage, wear or failure of repaired areas after the piece leaves our care. All repairs are undertaken at the client's risk.
        </div>
      </div>
      <div style={{textAlign:"center",fontSize:10,color:WG,marginTop:26}}>{`All prices inclusive of ${TAX_LABEL} · Quoted in ${CUR_CODE}`}</div>
    </div>
    {photo&&<div onClick={()=>setPhoto(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"30px 16px",cursor:"zoom-out"}}>
      <button onClick={e=>{e.stopPropagation();setPhoto(null);}} aria-label="Close image" style={{position:"fixed",top:14,right:14,width:46,height:46,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.5)",color:WHITE,fontSize:26,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:601}}>×</button>
      <img src={photo} alt="" style={{maxWidth:"100%",maxHeight:"100%",borderRadius:4,boxShadow:"0 20px 80px rgba(0,0,0,0.6)"}}/>
      <div style={{position:"fixed",bottom:16,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:12,pointerEvents:"none"}}>Tap the image or ✕ to close</div>
    </div>}
  </div>;
}

// Client-facing tax invoice (rendered inside PublicProposalPage when kind==="invoice").
function PublicInvoiceBody({snap}){
  const b=snap.biz||{};
  const bank=[["Bank",b.bankName],["Account name",b.bankAccountName],["BSB",b.bankBSB],["Account",b.bankAccount],["Reference",snap.number]].filter(([,v])=>v);
  // Amount the client still owes on this invoice (staged → the requested slice, else the balance).
  const owed=snap.staged?(Number(snap.dueNow)||0):((snap.paidTotal>0||snap.tradeIn>0)?(Number(snap.balance)||0):(Number(snap.totalIncGST)||0));
  const payUrl=(b.paymentLink||"").trim();
  return <div style={{maxWidth:680,margin:"0 auto"}}>
    {/* Header */}
    <div style={{background:INK,borderRadius:`${RADIUS}px ${RADIUS}px 0 0`,padding:"32px 32px 26px",color:WHITE,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:12}}>Tax Invoice</div>
        {b.logo
          ?<div style={{background:WHITE,borderRadius:4,padding:"8px 14px",display:"inline-block"}}><img src={b.logo} alt={b.name||"Logo"} style={{maxWidth:200,maxHeight:54,objectFit:"contain",display:"block"}}/></div>
          :<div style={{fontSize:24,fontWeight:800}}>{b.name||"Our Studio"}</div>}
        <div style={{marginTop:12,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.7}}>
          {b.address&&<div>{b.address}</div>}
          {(b.phone||b.email)&&<div>{[b.phone,b.email].filter(Boolean).join("  ·  ")}</div>}
          {b.abn&&<div style={{color:"rgba(255,255,255,0.32)"}}>{TAX_ID_LABEL} {b.abn}</div>}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:"0.04em"}}>{snap.number}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:8}}>Issued {fmtDate(snap.date)}</div>
      </div>
    </div>

    <div style={{background:WHITE,borderRadius:`0 0 ${RADIUS}px ${RADIUS}px`,border:`1px solid ${BD}`,borderTop:"none",padding:"28px 32px 32px",boxShadow:SHADOW}}>
      <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:6}}>Billed to</div>
      <div style={{fontSize:18,fontWeight:700,color:INK}}>{snap.clientName||"—"}</div>

      {/* Customer-facing lines — never the internal cost breakdown. Combined invoices itemise
          each option; single invoices show one description line. */}
      <div style={{marginTop:22,borderTop:`1px solid ${BD}`}}>
        {snap.customerLines&&snap.customerLines.length
          ?snap.customerLines.map((l,i)=>(
            <div key={l.id||i} style={{display:"flex",justifyContent:"space-between",gap:16,padding:"12px 0",borderBottom:`1px solid ${BD}`}}>
              <div style={{flex:1,fontSize:14,color:INK,lineHeight:1.6}}>{(l.description||"").trim()}</div>
              <div style={{fontSize:14,fontWeight:700,color:INK,whiteSpace:"nowrap"}}>{fmt(l.amount)}</div>
            </div>
          ))
          :<div style={{display:"flex",justifyContent:"space-between",gap:16,padding:"12px 0",borderBottom:`1px solid ${BD}`}}>
            <div style={{flex:1,fontSize:14,color:INK,lineHeight:1.6}}>{(snap.descriptionOverride||"").trim()}</div>
            <div style={{fontSize:14,fontWeight:700,color:INK,whiteSpace:"nowrap"}}>{fmt(snap.discount>0?snap.subtotalIncGST:snap.totalIncGST)}</div>
          </div>}
      </div>

      {/* Totals */}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <div style={{minWidth:240}}>
          {snap.discount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"3px 0"}}><span>Subtotal</span><span>{fmt(snap.subtotalIncGST)}</span></div>}
          {snap.discount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:OK,padding:"3px 0"}}><span>{snap.discountLabel||"Discount"}</span><span>−{fmt(snap.discount)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"3px 0"}}><span>Includes {TAX_LABEL}</span><span>{fmt(snap.gst)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:17,fontWeight:800,color:INK,borderTop:`2px solid ${INK}`,marginTop:8,paddingTop:10}}><span>{`Total (inc ${TAX_LABEL})`}</span><span>{fmt(snap.totalIncGST)}</span></div>
          {snap.tradeIn>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:OK,padding:"6px 0 3px"}}><span>Gold trade-in credit</span><span>−{fmt(snap.tradeIn)}</span></div>}
          {snap.paidTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:OK,padding:"6px 0 3px"}}><span>Paid to date</span><span>−{fmt(snap.paidTotal)}</span></div>}
          {snap.staged
            ?<>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:snap.dueNow>0?WARN:OK,borderTop:`1px solid ${BD}`,marginTop:4,paddingTop:8}}><span>Due now</span><span>{fmt(snap.dueNow)}</span></div>
              {snap.remainingAfter>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:WG,padding:"4px 0 0"}}><span>Balance remaining (payable later)</span><span>{fmt(snap.remainingAfter)}</span></div>}
            </>
            :(snap.paidTotal>0||snap.tradeIn>0)&&<div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:snap.balance>0?WARN:OK}}><span>Balance due</span><span>{fmt(snap.balance)}</span></div>}
        </div>
      </div>
      {(snap.paidTotal>0||snap.tradeIn>0)&&<div style={{textAlign:"right",fontSize:11,color:WG,marginTop:4}}>as at {fmtDate(snap.asAt)}</div>}

      {/* Payment details */}
      {bank.length>0&&<div style={{marginTop:24,background:PARCH,border:`1px solid ${BD}`,borderRadius:5,padding:"18px 20px"}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:12}}>Payment — direct deposit</div>
        <div style={{fontSize:14}}>
          {bank.map(([k,v])=><div key={k} style={{display:"flex",gap:16,padding:"3px 0"}}><div style={{color:WG,width:110,flexShrink:0}}>{k}</div><div style={{fontWeight:k==="Reference"?800:600,color:INK}}>{v}</div></div>)}
        </div>
        <div style={{fontSize:12,color:WG,marginTop:12,lineHeight:1.5}}>Please use <strong style={{color:INK}}>{snap.number}</strong> as the payment reference so we can match your payment.</div>
      </div>}
      {payUrl&&owed>0.005&&<div style={{marginTop:18,textAlign:"center"}}>
        <a href={payUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",background:INK,color:WHITE,textDecoration:"none",padding:"14px 34px",borderRadius:6,fontSize:15,fontWeight:700}}>Pay online</a>
        <div style={{fontSize:12,color:WG,marginTop:10}}>Amount due: <strong style={{color:INK}}>{fmt(owed)}</strong> · use reference <strong style={{color:INK}}>{snap.number}</strong></div>
      </div>}
      <div style={{textAlign:"center",fontSize:10,color:WG,marginTop:24}}>{`All amounts in ${CUR_CODE} · ${TAX_LABEL} inclusive`}</div>
    </div>
  </div>;
}

// ── Public client-facing proposal page (no login) ─────────────────────────
// Rendered standalone when the app is opened at /?p=<token>. Reads an immutable
// snapshot from the public_proposals table via RPC. Handles proposals (accept one
// option) and, when kind==="invoice", renders a read-only tax invoice instead.
function PublicProposalPage({token}){
  const [state,setState]=useState("loading");   // loading | ready | accepted | error | notfound
  const [snap,setSnap]=useState(null);
  const [picks,setPicks]=useState([]);          // selected option ids (1 for single-select, many for multi)
  const [name,setName]=useState("");
  const [acceptedOption,setAcceptedOption]=useState("");
  const [acceptedName,setAcceptedName]=useState("");
  const [busy,setBusy]=useState(false);
  const [photo,setPhoto]=useState(null);   // lightbox image url

  useEffect(()=>{
    (async()=>{
      if(!supabaseEnabled){setState("error");return;}
      try{
        const{data,error}=await supabase.rpc("get_proposal",{p_token:token});
        if(error)throw error;
        const row=Array.isArray(data)?data[0]:data;
        if(!row){setState("notfound");return;}
        setSnap(row.data);
        if(row.status==="accepted"){setAcceptedOption(row.accepted_option||"");setAcceptedName(row.accepted_name||"");setState("accepted");}
        // Freeze an ignored quote once it's past its "valid until" date — the client can no longer
        // accept stale pricing (invoices never expire this way).
        else if(row.data?.kind!=="invoice"&&row.data?.validUntil&&String(row.data.validUntil)<today()){setState("expired");}
        else{const opts=row.data?.options||[];const isMulti=row.data?.selectMode==="multi";
          if(isMulti)setPicks([]);   // multi: nothing pre-ticked
          else{const rec=opts.find(o=>o.recommended);setPicks(rec?[rec.id]:(opts[0]?.id?[opts[0].id]:[]));}
          setState("ready");}
      }catch(e){setState("error");}
    })();
  },[token]);

  const accept=async()=>{
    if(!picks.length||!name.trim())return;
    const optionStr=picks.join(",");
    setBusy(true);
    try{
      const{data,error}=await supabase.rpc("accept_proposal",{p_token:token,p_option:optionStr,p_name:name.trim()});
      if(error)throw error;
      if(data===false){/* already accepted in the meantime */ }
      setAcceptedOption(optionStr);setAcceptedName(name.trim());setState("accepted");
    }catch(e){alert("Sorry — we couldn't record your acceptance. Please try again or contact the studio.");}
    setBusy(false);
  };

  // Repair accept/decline — reuses accept_proposal, storing the decision in accepted_option.
  const respondRepair=async(decision,nm)=>{
    const{error}=await supabase.rpc("accept_proposal",{p_token:token,p_option:decision,p_name:nm});
    if(error)throw error;
    setAcceptedOption(decision);setAcceptedName(nm);setState("accepted");
  };

  const wrap=(inner)=><div style={{minHeight:"100vh",background:CREAM,fontFamily:"'Poppins',system-ui,'Segoe UI',Roboto,sans-serif",padding:"24px 16px",boxSizing:"border-box"}}>{inner}</div>;
  if(state==="loading")return wrap(<div style={{textAlign:"center",color:WG,fontSize:14,marginTop:80}}>Loading your proposal…</div>);
  if(state==="error")return wrap(<div style={{maxWidth:440,margin:"80px auto 0",textAlign:"center",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 28px",boxShadow:SHADOW}}><div style={{fontSize:30,marginBottom:10}}>⚠️</div><div style={{fontSize:16,fontWeight:800,color:INK,marginBottom:6}}>Couldn't load this proposal</div><div style={{fontSize:13,color:WG,lineHeight:1.6}}>Please check the link, or get in touch with the studio.</div></div>);
  if(state==="notfound")return wrap(<div style={{maxWidth:440,margin:"80px auto 0",textAlign:"center",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 28px",boxShadow:SHADOW}}><div style={{fontSize:30,marginBottom:10}}>🔍</div><div style={{fontSize:16,fontWeight:800,color:INK,marginBottom:6}}>Proposal not found</div><div style={{fontSize:13,color:WG,lineHeight:1.6}}>This link may have expired or been withdrawn. Please contact the studio for an up-to-date quote.</div></div>);
  if(state==="expired")return wrap(<div style={{maxWidth:440,margin:"80px auto 0",textAlign:"center",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 28px",boxShadow:SHADOW}}><div style={{fontSize:30,marginBottom:10}}>⏳</div><div style={{fontSize:16,fontWeight:800,color:INK,marginBottom:6}}>This quote has expired</div><div style={{fontSize:13,color:WG,lineHeight:1.6}}>Prices may have changed since it was sent. Please get in touch with the studio for an up-to-date quote — we'd be glad to help.</div></div>);

  // Invoices ride on the same public table/link — render the invoice layout instead.
  if(snap.kind==="invoice")return wrap(<PublicInvoiceBody snap={snap}/>);
  if(snap.kind==="repair")return wrap(<PublicRepairBody snap={snap} responded={state==="accepted"} decision={acceptedOption} responderName={acceptedName} onRespond={respondRepair}/>);

  const b=snap.biz||{};
  const opts=snap.options||[];
  const accepted=state==="accepted";
  const multi=snap.selectMode==="multi";
  const selectedIds=accepted?String(acceptedOption||"").split(",").map(s=>s.trim()).filter(Boolean):picks;
  const selectedOpts=opts.filter(o=>selectedIds.includes(o.id));
  const comboPrice=selectedOpts.reduce((s,o)=>s+(o.price!=null?o.price:0),0);
  const toggle=id=>{if(accepted)return;multi?setPicks(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]):setPicks([id]);};

  return wrap(<div style={{maxWidth:680,margin:"0 auto"}}>
    {/* Header */}
    <div style={{background:INK,borderRadius:`${RADIUS}px ${RADIUS}px 0 0`,padding:"32px 32px 26px",color:WHITE}}>
      <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:12}}>Quote Proposal</div>
      {b.logo
        ?<div style={{background:WHITE,borderRadius:4,padding:"8px 14px",display:"inline-block"}}><img src={b.logo} alt={b.name||"Logo"} style={{maxWidth:200,maxHeight:54,objectFit:"contain",display:"block"}}/></div>
        :<div style={{fontSize:24,fontWeight:800}}>{b.name||"Our Studio"}</div>}
      <div style={{marginTop:12,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.7}}>
        {b.address&&<div>{b.address}</div>}
        {(b.phone||b.email)&&<div>{[b.phone,b.email].filter(Boolean).join("  ·  ")}</div>}
        {b.abn&&<div style={{color:"rgba(255,255,255,0.32)"}}>{TAX_ID_LABEL} {b.abn}</div>}
      </div>
    </div>

    <div style={{background:WHITE,borderRadius:`0 0 ${RADIUS}px ${RADIUS}px`,border:`1px solid ${BD}`,borderTop:"none",padding:"28px 32px 32px",boxShadow:SHADOW}}>
      <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:6}}>Prepared for</div>
      <div style={{fontSize:20,fontWeight:700,color:INK,marginBottom:4}}>{snap.clientName||"—"}</div>
      <div style={{fontSize:13,color:WG}}>{snap.jobType} · Valid until {fmtDate(snap.validUntil)}</div>
      {snap.intro&&<div style={{fontSize:14,color:"#444",lineHeight:1.7,marginTop:16}}>{snap.intro}</div>}

      {accepted&&<div style={{background:OK+"12",border:`1px solid ${OK}55`,borderRadius:4,padding:"16px 18px",margin:"20px 0 4px"}}>
        <div style={{fontSize:15,fontWeight:800,color:OK,marginBottom:3}}>✓ Thank you, {acceptedName||"and welcome"}!</div>
        <div style={{fontSize:13,color:INK,lineHeight:1.6}}>You've accepted <strong>{selectedOpts.length?selectedOpts.map(o=>o.label).join(" + "):"your option"}</strong>{comboPrice>0?` at ${fmtR(comboPrice)} (inc ${TAX_LABEL})`:""}. The studio has been notified and will be in touch about your deposit and next steps.</div>
      </div>}

      {/* Options */}
      <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",margin:"24px 0 6px"}}>{accepted?"Your selection":multi?"Choose the pieces you'd like":opts.length>1?"Choose an option":"Your quote"}</div>
      {!accepted&&multi&&<div style={{fontSize:12,color:WG,marginBottom:12}}>Tick every piece you'd like — you can choose more than one.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {opts.map(o=>{
          const isSel=selectedIds.includes(o.id);
          const dim=accepted&&!isSel;
          return <div key={o.id} onClick={()=>toggle(o.id)}
            style={{border:`2px solid ${isSel?GOLD:BD}`,borderRadius:5,padding:"16px 18px",cursor:accepted?"default":"pointer",background:isSel?GOLD_L+"44":WHITE,opacity:dim?0.5:1,transition:"all 0.15s",position:"relative"}}>
            {o.recommended&&<div style={{position:"absolute",top:-9,left:16,background:GOLD,color:WHITE,fontSize:9,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"2px 10px",borderRadius:3}}>Recommended</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {!accepted&&<div style={{width:18,height:18,borderRadius:multi?4:"50%",border:`2px solid ${isSel?GOLD:BD}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{isSel&&(multi?<span style={{color:GOLD,fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>:<div style={{width:9,height:9,borderRadius:"50%",background:GOLD}}/>)}</div>}
                  <div style={{fontSize:16,fontWeight:700,color:INK}}>{o.label}</div>
                </div>
                {o.description&&<div style={{fontSize:13,color:WG,lineHeight:1.6,marginTop:6}}>{o.description}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:22,fontWeight:800,color:INK}}>{o.price!=null?fmtR(o.price):"—"}</div>
                <div style={{fontSize:10,color:WG}}>inc {TAX_LABEL}</div>
              </div>
            </div>
            {(()=>{const photos=o.photos&&o.photos.length?o.photos:(o.photo?[o.photo]:[]);return photos.length>0&&
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
                {photos.map((src,i)=><img key={i} src={src} alt={`${o.label} ${i+1}`} onClick={e=>{e.stopPropagation();setPhoto(src);}}
                  style={{width:84,height:84,objectFit:"cover",borderRadius:6,border:`1px solid ${BD}`,cursor:"zoom-in"}}/>)}
              </div>;})()}
            {(()=>{const emb=videoEmbed(o.video);if(!emb)return null;return <div style={{marginTop:14}} onClick={e=>e.stopPropagation()}>
              {emb.type==="iframe"
                ?<div style={{position:"relative",width:"100%",paddingBottom:"56.25%",borderRadius:6,overflow:"hidden",border:`1px solid ${BD}`}}>
                    <iframe src={emb.src} title={`${o.label} video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0}}/>
                  </div>
                :emb.type==="video"
                ?<video src={emb.src} controls style={{width:"100%",borderRadius:6,border:`1px solid ${BD}`,display:"block"}}/>
                :<a href={emb.href} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:GOLD_D,textDecoration:"none",border:`1px solid ${GOLD}`,borderRadius:6,padding:"8px 14px"}}>▶ Watch video</a>}
            </div>;})()}
          </div>;
        })}
      </div>

      {/* Combined total (multi-select) */}
      {multi&&selectedOpts.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:14,padding:"12px 16px",background:INK,borderRadius:4}}>
        <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Combined total · {selectedOpts.length} piece{selectedOpts.length!==1?"s":""}</span>
        <span style={{fontSize:20,fontWeight:800,color:WHITE}}>{fmtR(comboPrice)} <span style={{fontSize:11,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>inc {TAX_LABEL}</span></span>
      </div>}

      {/* Amount due now: a fixed figure if the studio typed one, otherwise the deposit % of whatever
          the client actually selected — so a bundle scales to the pieces they pick. Payments +
          trade-in already received are credited against it. */}
      {selectedOpts.length>0&&comboPrice>0&&(()=>{
        const paid=Number(snap.paidTotal)||0;
        const tradeIn=selectedOpts.reduce((s,o)=>s+(Number(o.tradeIn)||0),0);
        const tradeInNote=selectedOpts.map(o=>(o.tradeInNote||"").trim()).filter(Boolean).join(" · ");
        const pct=snap.depositPercent||50;
        const note=(snap.paymentNote||"").trim();
        const fullDue=Math.max(0,comboPrice-paid-tradeIn);
        // Fixed dollar amount only if the studio typed one; otherwise the deposit target is pct% of
        // the client's actual selection (scales down when they pick fewer pieces from a bundle).
        const fixed=Number(snap.dueNow)>0?Number(snap.dueNow):null;
        const depositTarget=fixed!=null?fixed:comboPrice*pct/100;
        const dueNowAmt=Math.max(0,Math.min(depositTarget-paid-tradeIn,fullDue));
        const remaining=Math.max(0,comboPrice-paid-tradeIn-dueNowAmt);
        // Nothing paid, no trade-in, plain % deposit → simple one-line prompt.
        if(fixed==null&&paid<=0.005&&tradeIn<=0.005)return <div style={{marginTop:14}}>
          <div style={{fontSize:12,color:WG}}>To proceed, a {pct}% deposit of <strong style={{color:INK}}>{fmtR(dueNowAmt)}</strong> is required.</div>
          {note&&<div style={{fontSize:12,color:WG,marginTop:6,fontStyle:"italic"}}>{note}</div>}
        </div>;
        const dueLabel=dueNowAmt<=0.005?(remaining<=0.005?"Paid in full":"Nothing due now"):(remaining>0.005?"Amount due now":"Balance now due");
        return <div style={{marginTop:16,background:PARCH,border:`1px solid ${BD}`,borderRadius:4,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"2px 0"}}><span>{multi?"Combined total":"Total price"} (inc {TAX_LABEL})</span><span style={{color:INK,fontWeight:600}}>{fmtR(comboPrice)}</span></div>
          {tradeIn>0.005&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"2px 0"}}><span>Gold trade-in credit</span><span style={{color:OK,fontWeight:600}}>− {fmtR(tradeIn)}</span></div>}
          {paid>0.005&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"2px 0"}}><span>Payments received</span><span style={{color:OK,fontWeight:600}}>− {fmtR(paid)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderTop:`1px solid ${BD}`,marginTop:8,paddingTop:10}}><span style={{fontSize:13,fontWeight:700,color:INK}}>{dueLabel}</span><span style={{fontSize:18,fontWeight:800,color:dueNowAmt<=0.005?OK:INK}}>{fmtR(dueNowAmt)}</span></div>
          {remaining>0.005&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:WG,paddingTop:6}}><span>Remaining on completion</span><span style={{color:INK,fontWeight:600}}>{fmtR(remaining)}</span></div>}
          {tradeInNote&&<div style={{fontSize:12,color:WG,marginTop:10,lineHeight:1.5,fontStyle:"italic"}}>Trade-in: {tradeInNote}</div>}
          {note&&<div style={{fontSize:12,color:WG,marginTop:tradeInNote?4:10,lineHeight:1.5,fontStyle:"italic"}}>{note}</div>}
        </div>;
      })()}

      {/* Accept box */}
      {!accepted&&<div style={{borderTop:`1px solid ${BD}`,marginTop:22,paddingTop:20}}>
        <div style={{fontSize:13,fontWeight:700,color:INK,marginBottom:10}}>Accept {multi?"your selection":"this proposal"}</div>
        {multi&&!picks.length&&<div style={{fontSize:12,color:WARN,marginBottom:10}}>Tick at least one piece above to continue.</div>}
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Type your full name to confirm" style={{...SS.inp,marginTop:0,marginBottom:12}}/>
        <button onClick={accept} disabled={!picks.length||!name.trim()||busy}
          style={{width:"100%",background:(!picks.length||!name.trim()||busy)?BD:INK,color:WHITE,border:"none",borderRadius:4,padding:"14px",fontSize:15,fontWeight:800,cursor:(!picks.length||!name.trim()||busy)?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>
          {busy?"Submitting…":multi?`Accept ${picks.length} piece${picks.length!==1?"s":""}${comboPrice>0?` — ${fmtR(comboPrice)}`:""}`:`Accept${selectedOpts[0]?` — ${selectedOpts[0].label}`:""}`}
        </button>
        <div style={{fontSize:11,color:WG,marginTop:10,lineHeight:1.5}}>By accepting you agree to the terms below. This records your selection and notifies the studio. It is not a payment. The studio will then send you an invoice to arrange payment.</div>
      </div>}

      {/* Terms */}
      {snap.terms&&<div style={{borderTop:`1px solid ${BD}`,marginTop:22,paddingTop:18}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:10}}>Terms &amp; conditions</div>
        <div style={{fontSize:11,color:WG,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{snap.terms}</div>
      </div>}
      <div style={{textAlign:"center",fontSize:10,color:WG,marginTop:24}}>{`All prices inclusive of ${TAX_LABEL} · Quoted in ${CUR_CODE}`}</div>
    </div>
    {photo&&<div onClick={()=>setPhoto(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"30px 16px",cursor:"zoom-out"}}>
      <button onClick={e=>{e.stopPropagation();setPhoto(null);}} aria-label="Close image" style={{position:"fixed",top:14,right:14,width:46,height:46,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.5)",color:WHITE,fontSize:26,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:601}}>×</button>
      <img src={photo} alt="" style={{maxWidth:"100%",maxHeight:"100%",borderRadius:4,boxShadow:"0 20px 80px rgba(0,0,0,0.6)"}}/>
      <div style={{position:"fixed",bottom:16,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:12,pointerEvents:"none"}}>Tap the image or ✕ to close</div>
    </div>}
  </div>);
}

// ── Quote Proposal Preview ────────────────────────────────────────────────
function ProposalPreview({quote,job,clients=[],biz,calc,payments=[],reconcilePayments=true,onClose}){
  const client=clients.find(x=>x.id===job?.clientId)||null;
  const quoteNum="QT-"+quote.id.slice(-6).toUpperCase();
  const issuedDate=new Date(quote.createdAt).toLocaleDateString(LOCALE,{day:"numeric",month:"long",year:"numeric"});
  const validDays=biz.quoteValidityDays||30;
  const validUntil=new Date(new Date(quote.createdAt).getTime()+validDays*86400000).toLocaleDateString(LOCALE,{day:"numeric",month:"long",year:"numeric"});
  const deposit=biz.depositPercent||50;
  const terms=biz.quoteTerms||"All custom jewellery requires a deposit before work commences. The final balance is due prior to collection. Quoted prices are valid for the period stated above. Price variations may apply if material costs change significantly. All pieces are handcrafted to order and cannot be returned unless faulty. Estimated completion times are indicative only.";
  // Grand total = setting final + stone client total (inc GST); a manual quoted price wins over everything
  const manual=quoteIsManual(quote);
  const stoneTotal=quote.stoneClientTotal||0;
  const markupUndef=!manual&&calc.base>0&&!calc.bracket&&!calc.overridden;   // jewellery costs present but no markup tier
  const settingTotal=markupUndef?0:calc.finalLow;
  const grandProposalTotal=manual?Number(quote.manualTotal):settingTotal+stoneTotal+(quote.accentStoneTotal||0);
  const priceDisplay=markupUndef?"Quote pending":fmtR(grandProposalTotal);
  const depositAmt=markupUndef?null:fmtR(grandProposalTotal*deposit/100);
  // Payments already recorded against this job → outstanding balance to request. Payments are
  // job-level, so we only net them against THIS quote when it's the job's sole billable quote —
  // otherwise a multi-piece deposit would be wrongly credited against one piece's total.
  const paidTotal=reconcilePayments?(payments||[]).filter(p=>p.jobId===job?.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0):0;
  const hasPaid=paidTotal>0.005;
  const qTrade=Number(quote.tradeInCredit)||0;                       // gold trade-in credit (received)
  const outstanding=Math.max(0,grandProposalTotal-qTrade-paidTotal);
  const paidInFull=hasPaid&&outstanding<=0.005;
  // Client-facing description — manual field takes priority over job description
  const description=quote.clientDescription||job?.description||"";

  const copyEmailText=()=>{
    const text=[
      `Dear ${clientDisplayName(client)},`,
      ``,
      `Thank you for your enquiry. Please find your quote below.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `QUOTE ${quoteNum}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${job?.type||"Custom Jewellery"}`,
      description||"",  // client description only
      ``,
      `Total price: ${priceDisplay} (inc. ${TAX_LABEL})`,
      ...((hasPaid||qTrade>0)?[
        ...(qTrade>0?[`Gold trade-in credit: -${fmtR(qTrade)}`]:[]),
        ...(hasPaid?[`Payments received: -${fmtR(paidTotal)}`]:[]),
        paidInFull?`Balance now due: ${fmtR(0)} — paid in full. Thank you.`:`Balance now due: ${fmtR(outstanding)}`,
      ]:[`Quote valid until: ${validUntil}`]),
      ``,
      ...((hasPaid||qTrade>0)?(paidInFull?[]:[`To proceed, please settle the outstanding balance of ${fmtR(outstanding)}.`]):[`To proceed, a ${deposit}% deposit of ${depositAmt||"—"} is required.`]),
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `TERMS & CONDITIONS`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      terms,
      ``,
      `Kind regards,`,
      biz.name||"",
      biz.phone||"",
      biz.email||"",
    ].filter(l=>l!==undefined).join("\n");
    navigator.clipboard?.writeText(text).then(()=>{}).catch(()=>{});
    setCopied(true);setTimeout(()=>setCopied(false),2000);
  };

  const[copied,setCopied]=useState(false);
  const clientName=clientDisplayName(client);

  // Pull the job's uploaded images into the proposal (secure signed URLs)
  const jobImages=job?.images||[];
  const[imgUrls,setImgUrls]=useState([]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!imagesEnabled()||!jobImages.length){setImgUrls([]);return;}
      const urls=[];
      for(const img of jobImages.slice(0,3)){
        const u=await signedImageUrl(img.path);
        if(u)urls.push({url:u,caption:img.caption||""});
      }
      if(!cancelled)setImgUrls(urls);
    })();
    return()=>{cancelled=true;};
  },[job?.id,jobImages.map(i=>i.path).join(",")]);

  return <div style={{position:"fixed",inset:0,background:"rgba(10,10,10,0.88)",zIndex:500,display:"flex",flexDirection:"column"}}>

    {/* ── Toolbar ── */}
    <div style={{background:INK,padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onClose} style={{background:"none",border:"1px solid rgba(255,255,255,0.18)",borderRadius:6,padding:"6px 14px",color:"rgba(255,255,255,0.65)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>← Back</button>
        <span style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.85)",letterSpacing:"0.05em"}}>Quote · {quoteNum}</span>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={copyEmailText} style={{background:copied?"#2D7A4F22":"rgba(255,255,255,0.06)",border:`1px solid ${copied?"#2D7A4F":"rgba(255,255,255,0.15)"}`,borderRadius:4,padding:"6px 16px",color:copied?"#4CAF84":"rgba(255,255,255,0.7)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
          {copied?"✓ Copied":"✉ Copy email text"}
        </button>
        <button onClick={()=>window.print()} style={{background:WHITE,border:"none",borderRadius:4,padding:"6px 18px",color:INK,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>
          Print / Save PDF
        </button>
      </div>
    </div>

    {/* ── Scroll area ── */}
    <div id="proposal-scroll" style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"40px 20px 60px",background:"#111"}}>
      <div id="proposal-document" style={{width:"100%",maxWidth:740,margin:"0 auto",background:WHITE,borderRadius:4,boxShadow:"0 20px 80px rgba(0,0,0,0.6)",fontFamily:"'Poppins',sans-serif",color:INK}}>

        {/* ── HEADER ── */}
        <div style={{background:INK,padding:"40px 52px 36px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontFamily:"'Poppins',sans-serif"}}>Quote</div>
            {biz.logo
              ?<div style={{background:WHITE,borderRadius:4,padding:"8px 14px",display:"inline-block"}}><img src={biz.logo} alt={biz.name||"Logo"} style={{maxWidth:220,maxHeight:60,objectFit:"contain",display:"block"}}/></div>
              :<div style={{fontSize:26,fontWeight:800,color:WHITE,letterSpacing:"-0.01em",fontFamily:"'Poppins',sans-serif",lineHeight:1.1}}>{biz.name||"Your Studio"}</div>}
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:3}}>
              {biz.address&&<div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'Poppins',sans-serif"}}>{biz.address}</div>}
              {(biz.phone||biz.email)&&<div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'Poppins',sans-serif"}}>{[biz.phone,biz.email].filter(Boolean).join("  ·  ")}</div>}
              {biz.abn&&<div style={{fontSize:10,color:"rgba(255,255,255,0.28)",fontFamily:"'Poppins',sans-serif",marginTop:2}}>{TAX_ID_LABEL} {biz.abn}</div>}
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:20,fontWeight:800,color:WHITE,letterSpacing:"0.06em",fontFamily:"'Poppins',sans-serif"}}>{quoteNum}</div>
            <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'Poppins',sans-serif"}}>Issued: <span style={{color:"rgba(255,255,255,0.7)"}}>{issuedDate}</span></div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'Poppins',sans-serif"}}>Valid until: <span style={{color:"rgba(255,255,255,0.85)"}}>{validUntil}</span></div>
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{height:1,background:BD}}/>

        {/* ── PREPARED FOR + JOB DESCRIPTION ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,borderBottom:`1px solid ${BD}`}}>
          <div style={{padding:"28px 32px 28px 52px",borderRight:`1px solid ${BD}`}}>
            <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:12,fontFamily:"'Poppins',sans-serif"}}>Prepared for</div>
            <div style={{fontSize:20,fontWeight:700,color:INK,fontFamily:"'Poppins',sans-serif",marginBottom:6}}>{clientName||"—"}</div>
            {client?.email&&<div style={{fontSize:12,color:WG,fontFamily:"'Poppins',sans-serif",marginTop:3}}>{client.email}</div>}
            {client?.phone&&<div style={{fontSize:12,color:WG,fontFamily:"'Poppins',sans-serif",marginTop:2}}>{client.phone}</div>}
          </div>
          <div style={{padding:"28px 52px 28px 32px"}}>
            <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:12,fontFamily:"'Poppins',sans-serif"}}>Piece</div>
            <div style={{fontSize:15,fontWeight:700,color:INK,fontFamily:"'Poppins',sans-serif",marginBottom:8}}>{(quote.pieceTitle||"").trim()||job?.type||"Custom Jewellery"}</div>
            {description
              ?<div style={{fontSize:13,color:"#444",lineHeight:1.75,fontFamily:"'Poppins',sans-serif"}}>{description}</div>
              :<div style={{fontSize:12,color:WG,fontStyle:"italic",fontFamily:"'Poppins',sans-serif"}}>No description added — edit quote to add one.</div>
            }
            {(job?.dateIn||job?.dateOut)&&<div style={{marginTop:16,display:"flex",gap:28}}>
              <div><div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Poppins',sans-serif"}}>Taken in</div><div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'Poppins',sans-serif"}}>{job?.dateIn?fmtDate(job.dateIn):"—"}</div></div>
              <div><div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Poppins',sans-serif"}}>Pickup / collection</div><div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'Poppins',sans-serif"}}>{job?.dateOut?fmtDate(job.dateOut):"—"}</div></div>
            </div>}
          </div>
        </div>

        {/* ── RENDER / IMAGE ── (only shown when the job has photos) */}
        {imgUrls.length>0&&<div style={{padding:"28px 52px",borderBottom:`1px solid ${BD}`}}>
          <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:14,fontFamily:"'Poppins',sans-serif"}}>Design &amp; reference</div>
          <div style={{display:"grid",gridTemplateColumns:imgUrls.length===1?"1fr":"1fr 1fr",gap:12}}>
            {imgUrls.map((im,i)=>(
              <div key={i} style={{gridColumn:imgUrls.length===3&&i===0?"1 / -1":"auto"}}>
                <img src={im.url} alt={im.caption||"Reference"} style={{width:"100%",height:imgUrls.length===1?320:220,objectFit:"cover",borderRadius:6,border:`1px solid ${BD}`,display:"block"}}/>
                {im.caption&&<div style={{fontSize:11,color:WG,marginTop:6,fontStyle:"italic",fontFamily:"'Poppins',sans-serif"}}>{im.caption}</div>}
              </div>
            ))}
          </div>
        </div>}

        {/* ── PRICE BREAKDOWN ── */}
        <div style={{padding:"28px 52px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
            <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",fontFamily:"'Poppins',sans-serif"}}>Price breakdown</div>
            <div style={{fontSize:10,color:WG,fontFamily:"'Poppins',sans-serif"}}>{`All prices inclusive of ${TAX_LABEL}`}</div>
          </div>

          {/* Jewellery row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:24,padding:"13px 0",borderTop:`1px solid ${BD}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'Poppins',sans-serif"}}>{(quote.pieceTitle||"").trim()||job?.type||"Jewellery piece"}</div>
              <div style={{fontSize:11,color:WG,marginTop:3,lineHeight:1.6,fontFamily:"'Poppins',sans-serif"}}>{description||"Design, materials & craftsmanship"}</div>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:INK,fontFamily:"'Poppins',sans-serif",whiteSpace:"nowrap"}}>{manual?<span style={{fontSize:12,fontWeight:400,fontStyle:"italic",color:WG}}>Included</span>:calc.bracket?fmtR(settingTotal):"—"}</div>
          </div>

          {/* Stone row — studio sourcing. Use the actual stone description(s) entered on the quote,
              falling back to a generic label only when none were given (mirrors the invoice). */}
          {quote.stoneMode==="sourcing"&&stoneTotal>0&&(()=>{
            const sDescs=(quote.stoneItems||[]).map(s=>(s.description||"").trim()).filter(Boolean);
            const sDetails=(quote.stoneItems||[]).map(s=>(s.detail||"").trim()).filter(Boolean);
            const title=sDescs.length?sDescs.join(" + "):"Centre / feature stone";
            const subParts=sDescs.length?(sDetails.length?[sDetails.join(" · ")]:[]):[(quote.stoneType==="lab"?"Lab-grown diamond / gemstone":"Natural diamond / gemstone")];
            subParts.push(`inc. ${TAX_LABEL}`);
            return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderTop:`1px solid ${BD}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'Poppins',sans-serif"}}>{title}</div>
                <div style={{fontSize:11,color:WG,marginTop:2,fontFamily:"'Poppins',sans-serif"}}>{subParts.join(" · ")}</div>
              </div>
              <div style={{fontSize:16,fontWeight:700,color:INK,fontFamily:"'Poppins',sans-serif"}}>{manual?<span style={{fontSize:12,fontWeight:400,fontStyle:"italic",color:WG}}>Included</span>:fmtR(stoneTotal)}</div>
            </div>;
          })()}

          {/* Client stone row */}
          {quote.stoneMode==="client"&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderTop:`1px solid ${BD}`}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'Poppins',sans-serif"}}>Centre / feature stone</div>
              <div style={{fontSize:11,color:WG,marginTop:2,fontFamily:"'Poppins',sans-serif"}}>Supplied by client — not included in this quote</div>
            </div>
            <div style={{fontSize:12,color:WG,fontStyle:"italic",fontFamily:"'Poppins',sans-serif"}}>Client supplied</div>
          </div>}

          {/* Total row — when payments are recorded, show total, payments received and balance due */}
          {!markupUndef&&(hasPaid||qTrade>0)
            ?<div style={{marginTop:12,background:INK,borderRadius:4,padding:"18px 22px",fontFamily:"'Poppins',sans-serif"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"rgba(255,255,255,0.65)",padding:"3px 0"}}>
                <span>Total price (inc. {TAX_LABEL})</span><span style={{color:WHITE,fontWeight:600}}>{priceDisplay}</span>
              </div>
              {qTrade>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"rgba(255,255,255,0.65)",padding:"3px 0"}}>
                <span>Gold trade-in credit</span><span style={{color:"#7FD7A6",fontWeight:600}}>− {fmtR(qTrade)}</span>
              </div>}
              {hasPaid&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"rgba(255,255,255,0.65)",padding:"3px 0"}}>
                <span>Payments received</span><span style={{color:"#7FD7A6",fontWeight:600}}>− {fmtR(paidTotal)}</span>
              </div>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderTop:"1px solid rgba(255,255,255,0.18)",marginTop:10,paddingTop:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>{paidInFull?"Paid in full":"Balance now due"}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{`Inc. ${TAX_LABEL} · ${CUR_CODE}`}</div>
                </div>
                <div style={{fontSize:30,fontWeight:800,color:paidInFull?"#7FD7A6":WHITE,letterSpacing:"-0.02em"}}>{fmtR(outstanding)}</div>
              </div>
            </div>
            :<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",marginTop:12,background:INK,borderRadius:4}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Poppins',sans-serif",marginBottom:2}}>Total quoted price</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'Poppins',sans-serif"}}>{`Inc. ${TAX_LABEL} · Quoted in ${CUR_CODE}`}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:30,fontWeight:800,color:WHITE,letterSpacing:"-0.02em",fontFamily:"'Poppins',sans-serif"}}>{priceDisplay}</div>
                {depositAmt&&<div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4,fontFamily:"'Poppins',sans-serif"}}>
                  {deposit}% deposit to commence: <span style={{color:WHITE,fontWeight:700}}>{depositAmt}</span>
                </div>}
              </div>
            </div>}
        </div>

        {/* ── TERMS ── */}
        <div style={{padding:"28px 52px",borderBottom:`1px solid ${BD}`}}>
          <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:14,fontFamily:"'Poppins',sans-serif"}}>Terms &amp; conditions</div>
          <div style={{fontSize:11,color:"#555",lineHeight:1.85,fontFamily:"'Poppins',sans-serif"}}>{terms}</div>
        </div>

        {/* ── CLIENT ACCEPTANCE ── */}
        <div style={{padding:"28px 52px 44px"}}>
          <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:14,fontFamily:"'Poppins',sans-serif"}}>Client acceptance</div>
          <div style={{fontSize:12,color:"#555",marginBottom:28,fontFamily:"'Poppins',sans-serif",lineHeight:1.75}}>
            I, the undersigned, accept the above quote and authorise work to commence upon payment of the required deposit.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px 40px"}}>
            {[["Signature",""],["Print name",""],["Date",""],["Deposit paid","$"]].map(([label,prefix])=>(
              <div key={label}>
                <div style={{borderBottom:`1px solid #CCC`,paddingBottom:6,minHeight:36,display:"flex",alignItems:"flex-end",fontSize:13,color:WG,fontFamily:"'Poppins',sans-serif"}}>{prefix}</div>
                <div style={{fontSize:10,color:WG,marginTop:6,fontFamily:"'Poppins',sans-serif",letterSpacing:"0.05em"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{borderTop:`1px solid ${BD}`,padding:"14px 52px",display:"flex",justifyContent:"space-between",alignItems:"center",background:PARCH}}>
          <div style={{fontSize:10,color:WG,fontFamily:"'Poppins',sans-serif"}}>{biz.name||""}{biz.name?" · ":""}{quoteNum}</div>
          <div style={{fontSize:10,color:WG,fontFamily:"'Poppins',sans-serif"}}>Valid until {validUntil}</div>
        </div>

      </div>
    </div>

    <style>{`
      @media print {
        @page { margin: 12mm; }
        html, body { background: #fff !important; }
        /* Hide everything, then reveal only the proposal document */
        body * { visibility: hidden !important; }
        #proposal-document, #proposal-document * { visibility: visible !important; }
        #proposal-scroll { position: static !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
        #proposal-document {
          position: absolute !important; left: 0 !important; top: 0 !important;
          width: 100% !important; max-width: 100% !important;
          box-shadow: none !important; border-radius: 0 !important; margin: 0 !important;
        }
        /* Make dark backgrounds (header, total) actually print */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>
  </div>;
}

// ── Quote detail ──────────────────────────────────────────────────────────
// Hook-free wrapper: only mount the detail body when the quote still exists. Keeping the
// not-found guard out here (instead of after the hooks in the body) avoids React #310 when a
// quote disappears mid-view (e.g. deleted, or removed by a realtime sync).
function QuoteDetail(props){
  if(!(props.quotes||[]).some(x=>x.id===props.quoteId))return null;
  return <QuoteDetailView {...props}/>;
}
function QuoteDetailView({quoteId,quotes,setQuotes,jobs,clients,biz,markupTable,naturalStoneMarkup,labStoneMarkup,tradeNatStoneMarkup=[],tradeLabStoneMarkup=[],payments=[],invoices=[],setView}){
  const isMobile=useIsMobile();
  const q=quotes.find(x=>x.id===quoteId);
  if(!q)return null;
  const job=jobs.find(j=>j.id===q.jobId);
  const c=job?clients.find(x=>x.id===job.clientId):null;
  const tradeQ=q.pricingMode==="trade";
  const calc=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
  // Trade quotes recompute the centre stone on the trade stone profile (metal/labour already
  // routes through effMarkupOverride above).
  const activeStoneMarkup=q.stoneType==="lab"?((tradeQ?tradeLabStoneMarkup:labStoneMarkup)||[]):((tradeQ?tradeNatStoneMarkup:naturalStoneMarkup)||[]);
  const stoneCalc=q.stoneMode==="sourcing"&&q.stoneItems?.length?calcStoneQuote(q.stoneItems,activeStoneMarkup,q.stoneMarkupOverride):null;
  const stoneClientTotal=stoneCalc?.clientTotal||0;
  const accentStoneTotal=q.accentStoneTotal||0;
  const manual=quoteIsManual(q);
  const grandTotal=manual?Number(q.manualTotal):calc.finalLow+stoneClientTotal+accentStoneTotal;
  // "—" only when there ARE jewellery costs but no markup tier matches; a stones-only
  // quote (no line items → base 0) is a valid total, not an undefined one.
  const markupUndef=!manual&&calc.base>0&&!calc.bracket&&!calc.overridden;
  const grandStr=markupUndef?"—":fmtR(grandTotal);
  const qTradeIn=Number(q.tradeInCredit)||0;
  const qPayable=Math.max(0,grandTotal-qTradeIn);
  // Set this quote's status only — other quotes on the job are left untouched, so a job can hold
  // several approved quotes at once (needed when a client accepts a multi-item bundle proposal).
  // The job's agreed charge sums every approved quote, so multiple approvals total up correctly.
  // Safeguard: an invoiced quote must stay Approved. Otherwise the Dashboard/Reports (which only
  // count approved quotes) and the Invoices page silently disagree on what's outstanding.
  const invoiceFor=(invoices||[]).find(i=>(i.quoteIds||(i.quoteId?[i.quoteId]:[])).includes(quoteId));
  const setStatus=s=>{
    if(s!=="Approved"&&invoiceFor){
      alert(`This quote is on invoice ${invoiceFor.number||""} — it has to stay Approved so your totals reconcile.\n\nIf the client hasn't actually accepted, delete the invoice first (Invoices page), then change the quote's status.`);
      return;
    }
    setQuotes(p=>{
      const n=p.map(x=>x.id===quoteId?{...x,status:s}:x);
      persist(K.qu,n);return n;
    });
  };
  const delQuote=()=>{
    if(invoiceFor){
      alert(`This quote is on invoice ${invoiceFor.number||""} — deleting it would orphan that invoice.\n\nDelete the invoice first (Invoices page), then delete the quote.`);
      return;
    }
    if(!confirm("Delete this quote? This cannot be undone."))return;
    setQuotes(p=>{const n=p.filter(x=>x.id!==quoteId);persist(K.qu,n);return n;});
    setView("jobDetail_"+q.jobId);
  };
  const dupQuote=()=>{const dup=duplicateQuoteObj(q);setQuotes(p=>{const n=[...p,dup];persist(K.qu,n);return n;});setView("editQuote_"+dup.id);};
  const[showProposal,setShowProposal]=useState(false);
  // Only net job payments against this quote when it's the job's sole approved (billable) quote —
  // otherwise a multi-piece deposit would be misapplied to one piece. Multi-piece orders should be
  // printed from the job's Proposals section, which totals every piece together.
  const jobApproved=(quotes||[]).filter(x=>x.jobId===q.jobId&&x.status==="Approved");
  const soleBilled=jobApproved.length<=1&&(jobApproved.length===0||jobApproved[0].id===q.id);

  return <div>
    {showProposal&&<ProposalPreview quote={q} job={job} clients={clients} biz={biz} calc={calc} payments={payments} reconcilePayments={soleBilled} onClose={()=>setShowProposal(false)}/>}
    <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"flex-start",gap:isMobile?14:10,marginBottom:20}}>
      <div style={{minWidth:0}}><h1 style={{margin:0,fontSize:isMobile?20:24,fontWeight:800,color:INK,letterSpacing:"-0.02em",wordBreak:"break-word",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>{quoteLabel(q)}{tradeQ&&<span style={{fontSize:11,fontWeight:800,letterSpacing:"0.08em",color:"#4E8B6A",background:"#EDF5EF",border:"1px solid #A6CBB4",borderRadius:999,padding:"3px 9px",textTransform:"uppercase"}}>Trade priced</span>}</h1>
      <div style={{color:WG,fontSize:13,marginTop:3}}>Quote {quoteRef(q)} · {job?.type} · {clientDisplayName(c)} · {fmtDate(q.createdAt)}</div>
      {(job?.dateIn||job?.dateOut)&&<div style={{color:WG,fontSize:12,marginTop:2}}>Taken in: <b style={{color:INK}}>{job?.dateIn?fmtDate(job.dateIn):"—"}</b> · Pickup: <b style={{color:INK}}>{job?.dateOut?fmtDate(job.dateOut):"—"}</b></div>}</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
        <Badge label={q.status} color={q.status==="Approved"?OK:q.status==="Draft"?WG:GOLD_D}/>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>setView("editQuote_"+q.id)}>✏ Edit quote</Btn>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={dupQuote}>⧉ Duplicate</Btn>
        <Btn sm={!isMobile} xs={isMobile} danger onClick={delQuote}>Delete</Btn>
        <Btn sm={!isMobile} xs={isMobile} onClick={()=>setShowProposal(true)}>📄 Preview &amp; Print quote</Btn>
      </div>
    </div>

    <Card>
      {/* Cost breakdown table */}
      <div style={{fontWeight:700,fontSize:14,color:INK,marginBottom:12}}>Cost breakdown</div>
      {!isMobile&&<div style={{display:"grid",gridTemplateColumns:"minmax(200px,1.4fr) minmax(200px,2fr) 44px 120px",gap:12,marginBottom:8}}>
        {[["Item","left"],["Detail","left"],["",""],["Cost","right"]].map(([h,align],i)=><div key={i} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:align}}>{h}</div>)}
      </div>}
      {q.lineItems.length===0&&<div style={{fontSize:13,color:WG,fontStyle:"italic",padding:"10px 0"}}>No itemised costs — this quote uses a manual quoted price.</div>}
      {q.lineItems.map(li=>{
        const cost=lineCost(li);
        const stoneMU=li.markupMode==="natural"||li.markupMode==="lab";
        const muBadge=stoneMU?<span style={{background:"#CDB2C1",color:"#3A2A6A",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:2,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>STONE MU</span>:li.noMarkup?<span style={{background:"#96627C",color:WHITE,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:2,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>NO MU</span>:null;
        const costCol=stoneMU?"#96627C":li.noMarkup?"#96627C":INK;
        if(isMobile)return <div key={li.id} style={{padding:"10px 0",borderBottom:`1px solid ${BD}`,fontSize:13}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline"}}>
            <span style={{fontWeight:600,color:INK,minWidth:0}}>{li.description}</span>
            <span style={{fontWeight:700,color:costCol,whiteSpace:"nowrap",flexShrink:0}}>{fmt(cost)}</span>
          </div>
          {(li.detail||muBadge)&&<div style={{color:WG,fontSize:12,marginTop:3,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>{li.detail&&<span>{li.detail}</span>}{muBadge}</div>}
        </div>;
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:"minmax(200px,1.4fr) minmax(200px,2fr) 44px 120px",gap:12,padding:"9px 0",borderBottom:`1px solid ${BD}`,fontSize:13,alignItems:"center"}}>
          <span style={{fontWeight:600,color:INK}}>{li.description}</span>
          <span style={{color:WG,fontSize:12}}>{li.detail}</span>
          <span>{muBadge}</span>
          <span style={{fontWeight:700,color:costCol,textAlign:"right"}}>{fmt(cost)}</span>
        </div>;
      })}

      {/* Markup summary — hidden for a pure manual-price quote (nothing to mark up) */}
      {q.lineItems.length>0&&<div style={{marginTop:20,marginBottom:q.stoneMode&&q.stoneMode!=="none"?24:0}}>
        <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Jewellery costs</div>
        <MarkupSummary {...calc} large/>
      </div>}

      {/* Client supplying stone note */}
      {q.stoneMode==="client"&&<div style={{background:"#EDF5EF",border:"1px solid #C4DECB",borderRadius:4,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:"#2C5282",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Centre / Feature Stone</div>
        <div style={{fontSize:13,color:"#2C5282"}}>Client supplying their own stone — no stone cost on this quote.</div>
        {q.stoneNotes&&<div style={{fontSize:12,color:"#4A7FA5",marginTop:6,fontStyle:"italic"}}>{q.stoneNotes}</div>}
      </div>}

      {/* Studio sourcing stone */}
      {q.stoneMode==="sourcing"&&q.stoneItems?.length>0&&<div style={{borderTop:`2px dashed ${BD}`,paddingTop:20,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{background:q.stoneType==="lab"?"#96627C":"#4E8B6A",color:WHITE,borderRadius:2,padding:"2px 10px",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>{q.stoneType==="lab"?"Lab-Grown Diamond / Gemstone":"Natural Diamond / Gemstone"}</div>
          <div style={{fontSize:13,fontWeight:700,color:INK}}>Centre / Feature Stone</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 130px",gap:6,marginBottom:6}}>
          {["Stone / description","Cert / source","Your cost"].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {q.stoneItems.map(li=>{
          const stoneCost=Number(li.cost)||Number(li.costLow)||0;
          return <div key={li.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 130px",gap:6,padding:"9px 0",borderBottom:`1px solid #EEE8FF`,fontSize:13,alignItems:"center"}}>
            <span style={{fontWeight:600,color:q.stoneType==="lab"?"#5A3D9A":"#1E4E7A"}}>{li.description}</span>
            <span style={{color:WG,fontSize:12}}>{li.detail}</span>
            <span style={{fontWeight:700,color:q.stoneType==="lab"?"#5A3D9A":"#1E4E7A",textAlign:"right"}}>{fmt(stoneCost)}</span>
          </div>;
        })}
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:700,color:q.stoneType==="lab"?"#96627C":"#4E8B6A",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Stone pricing — markup + {TAX_LABEL}</div>
          <StoneMarkupSummary calc={stoneCalc}/>
        </div>
        {q.stoneNotes&&<div style={{marginTop:10,fontSize:12,color:WG,fontStyle:"italic"}}>{q.stoneNotes}</div>}
      </div>}

      {/* Grand total bar — shown when there's a centre stone, accent stones on stone markup, or a manual price */}
      {(stoneCalc||accentStoneTotal>0||manual||qTradeIn>0)&&(()=>{
        const cells=[
          ...(manual&&!q.lineItems.length?[]:[["Jewellery piece",(manual&&calc.base>0&&!calc.bracket&&!calc.overridden)?"—":fmtR(calc.finalLow),GOLD]]),
          ...(accentStoneTotal>0?[["Accent stones",fmtR(accentStoneTotal),"#CDB2C1"]]:[]),
          ...(stoneCalc?[["Stone",fmtR(stoneCalc.clientTotal),q.stoneType==="lab"?"#CDB2C1":"#A6CBB4"]]:[]),
          ...(qTradeIn>0?[["Gold trade-in credit","−"+fmtR(qTradeIn),"#E79A9A"]]:[]),
          [qTradeIn>0?"Amount payable":(manual?"Quoted price — manual":"Combined total"),qTradeIn>0?fmtR(qPayable):grandStr,OK],
        ];
        return <div style={{background:INK,borderRadius:4,padding:"14px 20px",marginBottom:16,display:"grid",gridTemplateColumns:`repeat(${cells.length},1fr)`,gap:1}}>
          {cells.map(([l,v,col])=>(
            <div key={l} style={{padding:"8px 14px"}}>
              <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{l}</div>
              <div style={{fontSize:18,fontWeight:800,color:col}}>{v}</div>
            </div>
          ))}
        </div>;
      })()}

      {q.notes&&<div style={{marginTop:4,fontSize:13,color:WG,fontStyle:"italic",borderTop:`1px solid ${BD}`,paddingTop:12}}>{q.notes}</div>}
      {q.validUntil&&<div style={{fontSize:12,color:WG,marginTop:8}}>Valid until {fmtDate(q.validUntil)}</div>}

      <div style={{display:"flex",gap:8,marginTop:20,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,color:WG,fontWeight:700}}>Status:</span>
        {["Draft","Sent","Approved","Declined"].map(s=><Btn key={s} sm ghost={q.status!==s} onClick={()=>setStatus(s)}>{q.status===s?"✓ ":""}{s}</Btn>)}
      </div>
    </Card>
  </div>;
}

function QuotesList({quotes,jobs,clients,markupTable,biz,setView}){
  const isMobile=useIsMobile();
  const[modal,setModal]=useState(false);
  const[selClient,setSelClient]=useState("");
  const[selJob,setSelJob]=useState("");
  const[filter,setFilter]=useState("Active");   // Active = Draft + Sent (the actionable ones)
  const[search,setSearch]=useState("");
  const clientJobs=selClient?jobs.filter(j=>j.clientId===selClient):[];
  const validityDays=biz?.quoteValidityDays||30;

  // Per-quote derived facts: price, the client it's for, expiry + follow-up state
  const todayISO=localToday();
  const rows=quotes.map(q=>{
    const job=jobs.find(j=>j.id===q.jobId);
    const cl=job?clients.find(x=>x.id===job.clientId):null;
    const price=quoteGrandTotal(q,markupTable);
    const calc=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
    const priceKnown=quoteIsManual(q)||!(calc.base>0&&!calc.bracket&&!calc.overridden);
    // Expiry: explicit validUntil if set, else createdAt + business validity window
    const expiryISO=q.validUntil||(q.createdAt?addDays(String(q.createdAt).slice(0,10),validityDays):"");
    const isLive=q.status==="Draft"||q.status==="Sent";
    const expired=isLive&&expiryISO&&expiryISO<todayISO;
    const daysSent=q.status==="Sent"&&q.createdAt?Math.floor((parseISO(todayISO)-parseISO(String(q.createdAt).slice(0,10)))/86400000):0;
    const followUp=q.status==="Sent"&&daysSent>=5&&!expired;   // going stale, worth chasing
    return{q,job,cl,price,priceKnown,expiryISO,expired,daysSent,followUp};
  });

  // Summary strip — pipeline pulse
  const sentRows=rows.filter(r=>r.q.status==="Sent");
  const apprRows=rows.filter(r=>r.q.status==="Approved");
  const awaitingVal=sentRows.reduce((s,r)=>s+(r.priceKnown?r.price:0),0);
  const wonVal=apprRows.reduce((s,r)=>s+(r.priceKnown?r.price:0),0);
  const decided=rows.filter(r=>r.q.status==="Approved"||r.q.status==="Declined").length;
  const convRate=decided>0?Math.round(apprRows.length/decided*100):null;

  const counts={All:rows.length,Active:rows.filter(r=>r.q.status==="Draft"||r.q.status==="Sent").length,
    Draft:rows.filter(r=>r.q.status==="Draft").length,Sent:sentRows.length,Approved:apprRows.length,
    Declined:rows.filter(r=>r.q.status==="Declined").length};
  const TABS=["Active","All","Draft","Sent","Approved","Declined"];

  const s=search.trim().toLowerCase();
  const shown=rows.filter(r=>{
    const inTab=filter==="All"?true:filter==="Active"?(r.q.status==="Draft"||r.q.status==="Sent"):r.q.status===filter;
    if(!inTab)return false;
    if(!s)return true;
    return[quoteLabel(r.q),quoteRef(r.q),r.job?.type,r.cl?.name].filter(Boolean).some(x=>String(x).toLowerCase().includes(s));
  }).sort((a,b)=>String(b.q.createdAt||"").localeCompare(String(a.q.createdAt||"")));

  const stat=(label,val,sub,col)=>(
    <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:4,padding:"14px 16px"}}>
      <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div>
      <div style={{fontSize:20,fontWeight:800,color:col,marginTop:4}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:WG,marginTop:2}}>{sub}</div>}
    </div>
  );

  return <div>
    <SectionHeader eyebrow="Pricing" title="Quotes" subtitle="Build and track every quote, from first estimate to approval." action={<Btn onClick={()=>{setSelClient("");setSelJob("");setModal(true);}}>+ New Quote</Btn>}/>
    {quotes.length===0&&<Card>
      <div style={{color:WG,fontSize:14,textAlign:"center",padding:"24px 0"}}>
        <div style={{fontSize:32,marginBottom:10}}>✏️</div>
        <div style={{fontWeight:600,color:INK,marginBottom:6}}>No quotes yet</div>
        <div style={{marginBottom:16}}>Quotes are built per job — select a job below to get started.</div>
        <Btn onClick={()=>{setSelClient("");setSelJob("");setModal(true);}}>+ New Quote</Btn>
      </div>
    </Card>}

    {quotes.length>0&&<>
      {/* ── Summary strip ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
        {stat("Awaiting response",fmtR(awaitingVal),`${sentRows.length} quote${sentRows.length!==1?"s":""} sent`,sentRows.length?GOLD_D:WG)}
        {stat("Approved",fmtR(wonVal),`${apprRows.length} won`,apprRows.length?OK:WG)}
        {stat("Conversion",convRate==null?"—":`${convRate}%`,decided>0?`${apprRows.length} of ${decided} decided`:"No decisions yet",INK)}
      </div>

      {/* ── Filter tabs ── */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {TABS.map(t=>{
          const active=filter===t;
          const n=counts[t];
          return <button key={t} onClick={()=>setFilter(t)}
            style={{display:"flex",alignItems:"center",gap:7,padding:"6px 14px",borderRadius:3,border:`1px solid ${active?INK:BD}`,background:active?INK:"transparent",color:active?WHITE:WG,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>
            {t}<span style={{fontSize:11,fontWeight:700,color:active?"rgba(255,255,255,0.6)":WG}}>{n}</span>
          </button>;
        })}
      </div>

      {/* ── Search ── */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by client, job type or quote title…" style={{...SS.inp,marginTop:0,marginBottom:16}}/>

      {shown.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"18px 0"}}>No quotes match.</div></Card>}
    </>}

    {/* Group the shown quotes by job (newest-active group first, preserving the createdAt sort) */}
    {(()=>{
      const groups=[];const byJob=new Map();
      shown.forEach(r=>{
        const key=r.job?.id||"__none";
        let g=byJob.get(key);
        if(!g){g={key,job:r.job,cl:r.cl,rows:[]};byJob.set(key,g);groups.push(g);}
        g.rows.push(r);
      });
      return groups.map(g=>(
        <div key={g.key} style={{marginBottom:20}}>
          {/* Group header — client · job · stage · count (click to open the job) */}
          <div onClick={()=>g.job&&setView("jobDetail_"+g.job.id)}
            style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"8px 4px 8px 12px",borderLeft:`3px solid ${GOLD}`,marginBottom:8,cursor:g.job?"pointer":"default"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontWeight:800,fontSize:15,color:INK}}>{g.cl?clientDisplayName(g.cl):"Unassigned"}</span>
              {g.job&&<span style={{fontSize:13,color:WG}}>{g.job.type}</span>}
              {g.job&&<Badge label={g.job.stage} color={SC[g.job.stage]||WG}/>}
            </div>
            <span style={{fontSize:11,color:WG,fontWeight:700,whiteSpace:"nowrap"}}>{g.rows.length} quote{g.rows.length!==1?"s":""}{g.job?" ›":""}</span>
          </div>
          {/* Quotes for this job, nested under the header */}
          <div style={{display:"flex",flexDirection:"column",gap:8,paddingLeft:12}}>
            {g.rows.map(({q,price,priceKnown,expired,daysSent,followUp,expiryISO})=>{
              const manual=quoteIsManual(q);
              const calc=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");
              const priceStr=priceKnown?fmtR(price):"—";
              return <Card key={q.id} onClick={()=>setView("quoteDetail_"+q.id)}>
                <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"center",gap:isMobile?10:0}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:INK}}>{quoteLabel(q)} {q.title?.trim()&&<span style={{fontWeight:400,color:WG,fontSize:12}}>· {quoteRef(q)}</span>}</div>
                    <div style={{display:"flex",gap:10,fontSize:12,color:WG,marginTop:3,flexWrap:"wrap"}}>
                      <span>{fmtDate(q.createdAt)}</span>
                      {manual?<span style={{color:GOLD_D,fontWeight:700}}>Manual quoted price</span>:<span>Setting: {calc.mult||"—"}× markup</span>}
                      {q.stoneMode==="sourcing"&&<span style={{color:"#96627C"}}>+ {q.stoneType==="lab"?"Lab-Grown":"Natural"} stone</span>}
                      {q.stoneMode==="client"&&<span style={{color:"#96627C"}}>+ Client supplying stone</span>}
                    </div>
                    {/* Follow-up + expiry flags */}
                    {(followUp||expired)&&<div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                      {followUp&&<span style={{background:GOLD_L,color:GOLD_D,border:`1px solid ${GOLD}55`,borderRadius:3,padding:"2px 10px",fontSize:11,fontWeight:700}}>🔔 Sent {daysSent} days ago — follow up?</span>}
                      {expired&&<span style={{background:DANGER+"14",color:DANGER,border:`1px solid ${DANGER}44`,borderRadius:3,padding:"2px 10px",fontSize:11,fontWeight:700}}>⚠ Expired {fmtDate(expiryISO)}</span>}
                    </div>}
                  </div>
                  <div style={{display:"flex",gap:14,alignItems:"center",justifyContent:isMobile?"space-between":"flex-start",flexShrink:0}}>
                    <Badge label={q.status} color={q.status==="Approved"?OK:q.status==="Draft"?WG:q.status==="Declined"?DANGER:GOLD_D}/>
                    <div style={{fontWeight:800,fontSize:17,color:OK,textAlign:"right"}}>{priceStr}</div>
                  </div>
                </div>
              </Card>;
            })}
          </div>
        </div>
      ));
    })()}
    {modal&&<Modal title="New Quote — Select Job" onClose={()=>setModal(false)}>
      <div style={{fontSize:13,color:WG,marginBottom:16,lineHeight:1.6}}>
        Quotes are built inside a job. Pick the client and job below — you'll be taken straight to the quote builder.
      </div>
      <div style={{marginBottom:14}}>
        <label style={SS.lbl}>Client</label>
        <select value={selClient} onChange={e=>{setSelClient(e.target.value);setSelJob("");}} style={{...SS.inp,marginTop:4}}>
          <option value="">— Select client —</option>
          {clients.filter(cl=>jobs.some(j=>j.clientId===cl.id)).map(cl=><option key={cl.id} value={cl.id}>{cl.name}</option>)}
        </select>
      </div>
      {selClient&&<div style={{marginBottom:18}}>
        <label style={SS.lbl}>Job</label>
        {clientJobs.length===0
          ?<div style={{background:"#FFF8E1",border:"1px solid #F0C040",borderRadius:4,padding:"10px 14px",fontSize:13,color:WARN,marginTop:6}}>No jobs for this client yet. Create one in the Jobs tab first.</div>
          :<select value={selJob} onChange={e=>setSelJob(e.target.value)} style={{...SS.inp,marginTop:4}}>
            <option value="">— Select job —</option>
            {clientJobs.map(j=><option key={j.id} value={j.id}>{j.type} · {j.stage}</option>)}
          </select>}
      </div>}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn ghost onClick={()=>setModal(false)}>Cancel</Btn>
        <Btn disabled={!selJob} onClick={()=>{setModal(false);setView("newQuote_"+selJob);}}>Go to Quote Builder →</Btn>
      </div>
    </Modal>}
  </div>;
}

// ── Invoice number helper ─────────────────────────────────────────────────
// Next invoice number. Respects an optional prefix + starting number from business settings so the
// sequence can line up with the studio's Xero/MYOB numbering. `invoiceStart` acts as a floor (never
// go backwards). Parses the trailing digits of existing numbers so a prefix doesn't break the count.
const nextInvoiceNumber=(invoices,biz)=>{
  const prefix=(biz?.invoicePrefix||"");
  const startRaw=biz?.invoiceStart;
  const hasStart=startRaw!==undefined&&startRaw!==null&&String(startRaw).trim()!=="";
  const start=hasStart?(parseInt(String(startRaw).replace(/\D/g,""))||1):1001;
  const nums=(invoices||[]).map(i=>{const m=String(i.number||"").match(/(\d+)\s*$/);return m?parseInt(m[1],10):0;}).filter(n=>n>0);
  const maxExisting=nums.length?Math.max(...nums):0;
  const next=Math.max(maxExisting+1,start);
  const pad=hasStart?String(start).length:8;   // custom start → match its width; else 8-digit as before
  return prefix+String(next).padStart(pad,"0");
};

// ── Invoice print view ───────────────────────────────────────────────────
function InvoicePrintView({inv,job,client,biz,payments,onClose}){
  const paidTotal=(payments||[]).filter(p=>p.jobId===inv.jobId&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const invDiscount=Number(inv.discount)||0;
  const invSubtotal=inv.subtotalIncGST??inv.totalIncGST;
  const invTradeIn=Number(inv.tradeInCredit)||0;const balance=Math.max(0,inv.totalIncGST-invTradeIn-paidTotal);
  const requestAmount=Number(inv.requestAmount)||0;
  const staged=requestAmount>0;
  const dueNow=staged?Math.max(0,Math.min(requestAmount-paidTotal-invTradeIn,balance)):balance;   // credit payments/trade-in against the staged deposit
  const remainingAfter=Math.max(0,balance-dueNow);
  const[copied,setCopied]=useState(false);
  const copyBank=()=>{
    const txt=[`Bank: ${biz.bankName||""}`,`Account name: ${biz.bankAccountName||biz.name||""}`,`BSB: ${biz.bankBSB||""}`,`Account: ${biz.bankAccount||""}`,`Reference: ${inv.number}`].join("\n");
    navigator.clipboard?.writeText(txt).catch(()=>{});
    setCopied(true);setTimeout(()=>setCopied(false),2000);
  };
  // Rendered via a portal to document.body (OUTSIDE #root) so that during print we can simply
  // hide the whole app (#root) — the InvoiceDetail page behind this modal used to stay in the
  // print layout (visibility:hidden keeps an element's box), spilling blank pages after the invoice.
  return createPortal(<div id="invoice-print-modal" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:500,display:"flex",flexDirection:"column",backdropFilter:"blur(4px)"}}>
    {/* toolbar */}
    <div id="invoice-toolbar" style={{background:"#000",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <button onClick={onClose} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",borderRadius:2,padding:"6px 14px",color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase"}}>← Back</button>
        <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.85)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Tax Invoice — {inv.number}</div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={copyBank} style={{background:copied?"#2D7A4F":"rgba(255,255,255,0.08)",border:`1px solid ${copied?"#2D7A4F":"rgba(255,255,255,0.2)"}`,borderRadius:4,padding:"7px 16px",color:copied?WHITE:"rgba(255,255,255,0.8)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em",textTransform:"uppercase",transition:"all 0.2s"}}>{copied?"✓ Copied":"Copy bank details"}</button>
        <button onClick={()=>window.print()} style={{background:WHITE,border:"none",borderRadius:4,padding:"7px 20px",color:INK,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em",textTransform:"uppercase"}}>Print / Save PDF</button>
      </div>
    </div>
    {/* page */}
    <div id="invoice-scroll" style={{flex:1,overflow:"auto",padding:"32px 24px",display:"flex",justifyContent:"center",alignItems:"flex-start"}}>
      <div id="invoice-document" style={{width:"100%",maxWidth:700,minHeight:990,background:WHITE,fontFamily:"'Poppins',sans-serif",boxShadow:"0 8px 48px rgba(0,0,0,0.5)",display:"flex",flexDirection:"column"}}>
        {/* header */}
        <div style={{padding:"52px 56px 40px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            {biz.logo
              ?<img src={biz.logo} alt={biz.name||"Logo"} style={{maxWidth:240,maxHeight:80,objectFit:"contain",display:"block"}}/>
              :<div style={{background:INK,padding:"12px 20px 8px",display:"inline-block",borderRadius:4}}>
                  <div style={{fontSize:30,fontWeight:900,color:WHITE,letterSpacing:"0.12em",lineHeight:1}}>{biz.name||"VAHÉ"}</div>
                  <div style={{fontSize:8,fontWeight:400,color:"rgba(255,255,255,0.8)",letterSpacing:"0.3em",textAlign:"center",marginTop:3}}>JEWELLERY</div>
                </div>}
            {biz.abn&&<div style={{fontSize:10,color:WG,letterSpacing:"0.04em",marginTop:12}}>{TAX_ID_LABEL} {biz.abn}</div>}
            {(biz.email||biz.phone)&&<div style={{fontSize:11,color:WG,marginTop:3}}>{[biz.phone,biz.email].filter(Boolean).join("  ·  ")}</div>}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.18em",marginBottom:16}}>Tax Invoice</div>
            <table style={{fontSize:12,borderCollapse:"collapse",marginLeft:"auto"}}>
              <tbody>
                {[["Invoice no.",inv.number],["Issue date",fmtDate(inv.date)],["Due date","C.O.D."]].map(([l,v])=>(
                  <tr key={l}><td style={{color:WG,paddingRight:24,paddingBottom:7,fontWeight:500}}>{l}</td><td style={{fontWeight:700,color:INK,textAlign:"right",paddingBottom:7}}>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* bill to */}
        <div style={{padding:"0 56px 36px"}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:8}}>Bill to</div>
          <div style={{fontSize:17,color:INK,fontWeight:700}}>{clientDisplayName(client)||"—"}</div>
          {client?.address&&<div style={{fontSize:12,color:WG,marginTop:4}}>{client.address}</div>}
          {(client?.email||client?.phone)&&<div style={{fontSize:12,color:WG,marginTop:3}}>{[client?.email,client?.phone].filter(Boolean).join("  ·  ")}</div>}
        </div>

        {/* line items */}
        <div style={{padding:"0 56px"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${INK}`}}>
                <th style={{padding:"0 0 12px",textAlign:"left",fontWeight:700,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:WG,width:"64%"}}>Description</th>
                <th style={{padding:"0 0 12px",textAlign:"center",fontWeight:700,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:WG,width:"12%"}}>Tax</th>
                <th style={{padding:"0 0 12px",textAlign:"right",fontWeight:700,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:WG,width:"24%"}}>Amount (inc&nbsp;{TAX_LABEL})</th>
              </tr>
            </thead>
            <tbody>
              {/* Customer-facing invoice never shows internal cost lines. Combined invoices
                  itemise each option; otherwise it's the single typed description. */}
              {inv.customerLines&&inv.customerLines.length
                ?inv.customerLines.map((l,i)=>(
                  <tr key={l.id||i} style={{borderBottom:`1px solid ${BD_SOFT}`}}>
                    <td style={{padding:"18px 0",color:INK,lineHeight:1.65,whiteSpace:"pre-wrap",fontWeight:500}}>{(l.description||"").trim()}</td>
                    <td style={{padding:"18px 0",textAlign:"center",color:WG,fontSize:12}}>{TAX_LABEL}</td>
                    <td style={{padding:"18px 0",textAlign:"right",fontWeight:700,color:INK}}>{fmt(l.amount)}</td>
                  </tr>
                ))
                :<tr style={{borderBottom:`1px solid ${BD_SOFT}`}}>
                  <td style={{padding:"18px 0",color:INK,lineHeight:1.65,whiteSpace:"pre-wrap",fontWeight:500}}>{(inv.descriptionOverride||"").trim()}</td>
                  <td style={{padding:"18px 0",textAlign:"center",color:WG,fontSize:12}}>{TAX_LABEL}</td>
                  <td style={{padding:"18px 0",textAlign:"right",fontWeight:700,color:INK}}>{fmt(invDiscount>0?invSubtotal:inv.totalIncGST)}</td>
                </tr>}
            </tbody>
          </table>
        </div>

        {/* totals */}
        <div style={{padding:"28px 56px 40px",display:"flex",justifyContent:"flex-end"}}>
          <div style={{minWidth:300}}>
            {[...(invDiscount>0?[["Subtotal",fmt(invSubtotal)],[inv.discountLabel||"Discount","−"+fmt(invDiscount)]]:[]),[`Total (incl. ${TAX_LABEL})`,fmt(inv.totalIncGST)],[`Includes ${TAX_LABEL}`,fmt(inv.gst)],...(invTradeIn>0?[["Gold trade-in credit","−"+fmt(invTradeIn)]]:[]),["Paid to date",fmt(paidTotal)],...((staged||invTradeIn>0)?[["Balance outstanding",fmt(balance)]]:[])].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"8px 0",borderBottom:`1px solid ${BD_SOFT}`}}>
                <span style={{color:WG}}>{l}</span><span style={{fontWeight:600,color:INK}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:INK,color:WHITE,borderRadius:6,padding:"14px 18px",marginTop:14}}>
              <span style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"rgba(255,255,255,0.6)"}}>{staged?"Due now":"Balance due"}</span>
              <span style={{fontSize:22,fontWeight:800}}>{fmt(dueNow)}</span>
            </div>
            {staged&&remainingAfter>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:WG,padding:"8px 2px 0"}}><span>Balance remaining (payable later)</span><span style={{fontWeight:600}}>{fmt(remainingAfter)}</span></div>}
          </div>
        </div>

        {inv.notes&&<div style={{padding:"0 56px 36px"}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:8}}>Notes</div>
          <div style={{fontSize:12,color:INK,lineHeight:1.7}}>{inv.notes}</div>
        </div>}

        {/* how to pay */}
        <div style={{borderTop:`1px solid ${BD_SOFT}`,padding:"36px 56px"}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:18}}>How to pay</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:36,alignItems:"start"}}>
            <div style={{fontSize:12,color:INK,lineHeight:2.1}}>
              <div><span style={{color:WG}}>Bank</span>&nbsp;&nbsp;<span style={{fontWeight:600}}>{biz.bankName||"—"}</span></div>
              <div><span style={{color:WG}}>Name</span>&nbsp;&nbsp;<span style={{fontWeight:600}}>{biz.bankAccountName||biz.name||"—"}</span></div>
              <div><span style={{color:WG}}>BSB</span>&nbsp;&nbsp;<strong>{biz.bankBSB||"—"}</strong></div>
              <div><span style={{color:WG}}>Account</span>&nbsp;&nbsp;<strong>{biz.bankAccount||"—"}</strong></div>
              <div><span style={{color:WG}}>Reference</span>&nbsp;&nbsp;<strong>{inv.number}</strong></div>
            </div>
            <div style={{fontSize:12,color:WG,lineHeight:1.8}}>
              Please use invoice number <strong style={{color:INK}}>{inv.number}</strong> as your payment reference so we can match your payment quickly. Thank you for your business.
              {!biz.bankBSB&&<div style={{marginTop:10,color:WARN,fontSize:11}}>⚠ Add bank details in Settings → Business details to show here.</div>}
            </div>
          </div>
        </div>

        {/* footer (pinned to bottom of the page) */}
        <div style={{marginTop:"auto",padding:"18px 56px",display:"flex",justifyContent:"space-between",fontSize:10,color:WG,borderTop:`1px solid ${BD_SOFT}`}}>
          <span>{biz.name||"VAHÉ Jewellery"}</span>
          <span>Invoice {inv.number}</span>
          <span>Balance due {fmt(balance)}</span>
        </div>
      </div>
    </div>

    <style>{`
      @media print {
        @page { size: A4; margin: 12mm; }
        html, body { background: #fff !important; height: auto !important; }
        /* The modal is portaled to <body>, OUTSIDE #root — hide the whole app so ONLY the invoice
           prints. (Previously body *{visibility:hidden} left the app's boxes in the print layout,
           which pushed blank pages after the invoice.) */
        #root { display: none !important; }
        /* Drop the overlay chrome so the document prints in normal flow from the top-left. */
        #invoice-print-modal { position: static !important; display: block !important; background: none !important; backdrop-filter: none !important; height: auto !important; }
        #invoice-toolbar { display: none !important; }
        #invoice-scroll { position: static !important; display: block !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
        #invoice-document {
          position: static !important; width: 100% !important; max-width: 100% !important;
          min-height: 0 !important; box-shadow: none !important; margin: 0 auto !important;
        }
        #invoice-document table, #invoice-document tr { page-break-inside: avoid; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>
  </div>, document.body);
}

// ── Error boundary ────────────────────────────────────────────────────────
// A render error in any single view used to unmount the whole React tree → blank
// white screen → forced app reload. This catches it, keeps the sidebar/nav alive,
// and shows a recoverable panel with the error text so the failure is diagnosable
// (and never destroys the user's saved data, which is persisted before render).
class ErrorBoundary extends Component{
  constructor(props){super(props);this.state={err:null};}
  static getDerivedStateFromError(err){return{err};}
  componentDidCatch(err,info){try{console.error("App render error:",err,info?.componentStack);}catch(e){}}
  reset(){this.setState({err:null});}
  render(){
    if(!this.state.err)return this.props.children;
    const msg=String(this.state.err?.message||this.state.err||"Unknown error");
    const stack=String(this.state.err?.stack||"");
    return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 16px"}}>
      <div style={{maxWidth:520,width:"100%",background:WHITE,border:`1px solid ${DANGER}44`,borderRadius:RADIUS,padding:"30px 28px",boxShadow:SHADOW}}>
        <div style={{fontSize:30,marginBottom:10}}>⚠️</div>
        <div style={{fontSize:17,fontWeight:800,color:INK,marginBottom:8}}>Something went wrong on this screen</div>
        <div style={{fontSize:13,color:WG,lineHeight:1.6,marginBottom:16}}>Your data is safe — this only affected what's shown here. Use the menu to go to another screen, or reload the app. If it keeps happening, copy the details below and send them over so it can be fixed.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
          <Btn sm onClick={()=>this.reset()}>Try again</Btn>
          <Btn sm ghost onClick={()=>{this.reset();this.props.onHome&&this.props.onHome();}}>Go to dashboard</Btn>
          <Btn sm ghost onClick={()=>window.location.reload()}>Reload app</Btn>
        </div>
        <details style={{fontSize:12,color:WG}}>
          <summary style={{cursor:"pointer",fontWeight:700,color:INK}}>Error details</summary>
          <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",marginTop:8,padding:12,background:CREAM,border:`1px solid ${BD}`,borderRadius:6,fontSize:11,lineHeight:1.5,maxHeight:220,overflow:"auto"}}>{msg}{stack?"\n\n"+stack:""}</pre>
        </details>
      </div>
    </div>;
  }
}

// ── Invoice detail ────────────────────────────────────────────────────────
// Hook-safe guard: only mount the detail body when the invoice exists. Keeping this early return in
// a hook-free wrapper (instead of inside the body, above the hooks) avoids React #310 when an
// invoice disappears mid-view (e.g. deleted, or removed by a realtime sync).
function InvoiceDetail(props){
  if(!(props.invoices||[]).some(x=>x.id===props.invoiceId))return null;
  return <InvoiceDetailView {...props}/>;
}
function InvoiceDetailView({invoiceId,invoices,setInvoices,jobs,clients,payments,biz,setView,quotes=[],markupTable}){
  const isMobile=useIsMobile();
  const inv=invoices.find(x=>x.id===invoiceId);
  const job=jobs.find(j=>j.id===inv.jobId);
  const c=job?clients.find(x=>x.id===job.clientId):null;
  const es=invoiceEffectiveStatus(inv,payments,invoices);
  const autoPaid=es==="Paid"&&inv.status!=="Paid";   // covered by recorded payments, not manually set
  const[showPrint,setShowPrint]=useState(false);
  const[resyncMsg,setResyncMsg]=useState("");
  const setStatus=s=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,status:s}:x);persist(K.inv,n);return n;});
  const del=()=>{
    if(!confirm(`Delete invoice ${inv.number}? This can't be undone. Payments recorded against the job are not affected, and the quote stays so you can re-invoice it.`))return;
    setInvoices(p=>{const n=p.filter(x=>x.id!==invoiceId);persist(K.inv,n);return n;});
    setView("invoices");
  };
  const setDescOverride=v=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,descriptionOverride:v}:x);persist(K.inv,n);return n;});
  // The description box uses a local draft and commits on blur, so persisting/cloud-sync on
  // every keystroke can't echo a stale value back mid-type (which made the cursor jump).
  const descRef=useRef(null);
  const[descDraft,setDescDraft]=useState(inv.descriptionOverride||"");
  useEffect(()=>{if(document.activeElement!==descRef.current)setDescDraft(inv.descriptionOverride||"");},[inv.descriptionOverride]);
  const commitDesc=()=>{if(descDraft!==(inv.descriptionOverride||""))setDescOverride(descDraft);};
  // Combined invoices itemise per option — let the studio rename each customer-facing line.
  const setCustomerLineDesc=(lineId,v)=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,customerLines:(x.customerLines||[]).map(l=>l.id===lineId?{...l,description:v}:l)}:x);persist(K.inv,n);return n;});
  const hasCustomerLines=Array.isArray(inv.customerLines)&&inv.customerLines.length>0;
  // "Update from quote" — only for single-quote invoices (multi/combined invoices itemise per option).
  const srcQuote=quotes.find(q=>q.id===inv.quoteId);
  const canResync=!!srcQuote&&(!inv.quoteIds||inv.quoteIds.length<=1)&&!hasCustomerLines;
  // Does re-syncing actually change anything? Compare the quote's current gross + trade-in to what the
  // invoice holds, and count a pending discount (which the re-sync would clear) as a difference too.
  const freshTotal=srcQuote?quoteGrandTotal(srcQuote,markupTable):0;
  const freshTradeIn=srcQuote?Number(srcQuote.tradeInCredit)||0:0;
  const invGross=inv.subtotalIncGST??inv.totalIncGST??0;
  const totalDiffers=Math.abs(freshTotal-invGross)>0.005;
  const tradeInDiffers=Math.abs(freshTradeIn-(Number(inv.tradeInCredit)||0))>0.005;
  const hasDiscount=(Number(inv.discount)||0)>0.005;
  // A deliberate invoice discount is not a reason to nag "update needed" — only a changed quote is.
  const invoiceDiffers=canResync&&(totalDiffers||tradeInDiffers);
  const updateFromQuote=()=>{
    if(!srcQuote)return alert("The quote this invoice was created from no longer exists.");
    if(!invoiceDiffers){setResyncMsg("✓ Already matches the quote");setTimeout(()=>setResyncMsg(""),2600);return;}
    if(!confirm("Replace this invoice's line items and totals with the current quote (including any gold trade-in credit)? Any manual edits to the invoice lines — and any invoice-level discount — will be reset to match the quote. The invoice number, date and status are kept."))return;
    const changed=[];
    if(totalDiffers)changed.push("amounts");
    if(tradeInDiffers)changed.push("trade-in");
    if(hasDiscount)changed.push("discount cleared");
    const content=invoiceContentFromQuote(srcQuote,job,markupTable);
    // Reset subtotalIncGST to the fresh gross too — otherwise a later discount would net off a stale baseline.
    setInvoices(p=>{const n=p.map(i=>i.id===inv.id?{...i,...content,subtotalIncGST:content.totalIncGST,discount:0,discountLabel:""}:i);persist(K.inv,n);return n;});
    setResyncMsg("✓ Updated: "+changed.join(", "));setTimeout(()=>setResyncMsg(""),3000);
  };
  const setRequestAmount=v=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,requestAmount:v}:x);persist(K.inv,n);return n;});
  const setNumber=v=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,number:v}:x);persist(K.inv,n);return n;});
  const[editNum,setEditNum]=useState(null);   // inline edit of the invoice number (match Xero/MYOB)
  // Discount: subtotalIncGST is the gross baseline; totalIncGST/gst become the discounted (net)
  // figures so every existing consumer (balances, summaries, links) reflects the discount.
  const setDiscount=(amt,label)=>setInvoices(p=>{const n=p.map(x=>{
    if(x.id!==invoiceId)return x;
    const sub=x.subtotalIncGST??x.totalIncGST;   // capture gross once (old invoices: their total is the gross)
    const disc=Math.min(Math.max(0,Number(amt)||0),sub);
    const net=sub-disc;
    return{...x,subtotalIncGST:sub,discount:disc,discountLabel:label!==undefined?label:(x.discountLabel||"Discount"),totalIncGST:net,gst:net-net/(1+GST_RATE)};
  });persist(K.inv,n);return n;});
  const subtotalIncGST=inv.subtotalIncGST??inv.totalIncGST;
  const discount=Number(inv.discount)||0;
  const paidTotal=(payments||[]).filter(p=>p.jobId===inv.jobId&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const invTradeIn=Number(inv.tradeInCredit)||0;const balance=Math.max(0,inv.totalIncGST-invTradeIn-paidTotal);
  // Staged request: optionally request only a specific amount now (e.g. the diamond balance),
  // with the rest noted as payable later. Blank = request the full outstanding balance.
  const requestAmount=Number(inv.requestAmount)||0;
  const staged=requestAmount>0;
  const dueNow=staged?Math.max(0,Math.min(requestAmount-paidTotal-invTradeIn,balance)):balance;   // credit payments/trade-in against the staged deposit
  const remainingAfter=Math.max(0,balance-dueNow);
  // Shareable client link — same public table/link mechanism as proposals. Re-snapshots
  // the invoice each time so the link always reflects current totals & balance.
  const[linkBusy,setLinkBusy]=useState(false);
  const[linkCopied,setLinkCopied]=useState(false);
  const invLink=inv.publicToken?`${window.location.origin}/?p=${inv.publicToken}`:"";
  const shareInvoice=async()=>{
    if(!supabaseEnabled)return alert("Online invoice links need the cloud — you appear to be in local-only mode.");
    setLinkBusy(true);
    let token=inv.publicToken;
    if(!token){token=proposalToken();setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,publicToken:token}:x);persist(K.inv,n);return n;});}
    const snapshot=buildInvoiceSnapshot({inv,job,client:c,biz,payments});
    const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).upsert({token,studio_id:_studioId,data:snapshot,status:"sent",created_at:new Date().toISOString()},{onConflict:"token"});
    setLinkBusy(false);
    if(error){alert("Couldn't create the link: "+error.message+"\n\nIf it mentions a missing table, the proposals Supabase setup (supabase-public-proposals.sql) hasn't been run.");return;}
    navigator.clipboard?.writeText(`${window.location.origin}/?p=${token}`).catch(()=>{});
    setLinkCopied(true);setTimeout(()=>setLinkCopied(false),2200);
  };
  const exportOne=()=>{
    const{paidMap,balMap}=invoicePaidBalanceMap(invoices,payments);
    downloadInvoiceCsv([invoiceCsvRow(inv,{jobs,clients,payments,allInvoices:invoices,paidMap,balMap})],`invoice-${(inv.number||inv.id||"").replace(/[^\w-]/g,"")||"export"}.csv`);
  };
  return <div>
    {showPrint&&<InvoicePrintView inv={inv} job={job} client={c} biz={biz} payments={payments} onClose={()=>setShowPrint(false)}/>}
    <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center"}}>
      <button onClick={()=>setView("invoices")} style={{background:"none",border:"none",cursor:"pointer",color:GOLD,fontSize:13,fontWeight:700,fontFamily:"inherit",padding:0}}>← Invoices</button>
      {job&&<><span style={{color:BD}}>·</span><button onClick={()=>setView("jobDetail_"+inv.jobId)} style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:13,fontFamily:"inherit",padding:0}}>View job</button></>}
    </div>
    <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"flex-start",gap:isMobile?14:10,marginBottom:20}}>
      <div style={{minWidth:0}}>
        {editNum!==null
          ?<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2}}>
              <input value={editNum} onChange={e=>setEditNum(e.target.value)} autoFocus style={{...SS.inp,marginTop:0,fontSize:isMobile?18:22,fontWeight:700,padding:"4px 10px",width:isMobile?"100%":240,color:INK,border:`1px solid ${GOLD}`}}/>
              <Btn sm onClick={()=>{const v=(editNum||"").trim();if(!v){setEditNum(null);return;}if(invoices.some(x=>x.id!==invoiceId&&String(x.number)===v)&&!confirm(`Invoice number "${v}" is already used by another invoice. Use it anyway?`))return;setNumber(v);setEditNum(null);}}>Save</Btn>
              <Btn sm ghost onClick={()=>setEditNum(null)}>Cancel</Btn>
            </div>
          :<h1 style={{margin:0,fontSize:isMobile?20:24,fontWeight:700,color:INK,wordBreak:"break-word",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>{inv.number}<button onClick={()=>setEditNum(String(inv.number||""))} title="Edit invoice number to match your bookkeeping software" style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,cursor:"pointer",color:WG,fontSize:12,fontWeight:700,padding:"3px 9px",fontFamily:"inherit"}}>✎ Edit</button></h1>}
        <div style={{color:WG,fontSize:13,marginTop:3}}>{job?.type} · {clientDisplayName(c)} · {fmtDate(inv.date)}</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
        <Badge label={es} color={es==="Paid"?OK:es==="Overdue"?DANGER:WARN} size="lg"/>
        <Btn sm={!isMobile} xs={isMobile} onClick={shareInvoice}>{linkBusy?"Creating…":linkCopied?"✓ Link copied":<>{ICON_LINK}{inv.publicToken?"Copy link":"Create link"}</>}</Btn>
        {inv.publicToken&&<EmailClientButton to={c?.email} clientName={clientDisplayName(c)} biz={biz} linkUrl={invLink} docType="invoice" defaultSubject={`Invoice ${inv.number} from ${biz?.name||"us"}`} defaultMessage={`Please find your invoice below. You can view the full details and payment information using the button.`}/>}
        {inv.publicToken&&<Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>window.open(invLink,"_blank")}>Preview</Btn>}
        {canResync&&<Btn sm={!isMobile} xs={isMobile} ghost={!invoiceDiffers} onClick={updateFromQuote}>{resyncMsg||(invoiceDiffers?"↻ Update from quote":"✓ Matches quote")}</Btn>}
        <Btn sm={!isMobile} xs={isMobile} onClick={()=>setShowPrint(true)}>{ICON_PRINT}Preview &amp; Print</Btn>
        <Btn sm={!isMobile} xs={isMobile} ghost onClick={exportOne}>{ICON_CSV}CSV</Btn>
        <Btn sm={!isMobile} xs={isMobile} danger onClick={del}>Delete</Btn>
      </div>
    </div>
    {inv.publicToken&&<div style={{background:GOLD_L+"55",border:`1px solid ${GOLD}55`,borderRadius:4,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:12,fontWeight:700,color:GOLD_D,whiteSpace:"nowrap"}}>{ICON_LINK}Client link</span>
      <span style={{flex:1,minWidth:200,fontSize:12,color:WG,wordBreak:"break-all",fontFamily:"monospace"}}>{invLink}</span>
      <span style={{fontSize:11,color:WG}}>Re-copy to refresh totals before sending.</span>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:staged?10:18}}>
      {[["Invoice total",fmt(inv.totalIncGST),INK],["Received",fmt(paidTotal+invTradeIn),OK],[staged?"Due now":"Balance due",fmt(dueNow),dueNow>0.5?WARN:OK]].map(([l,v,col])=>(
        <div key={l} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:4,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div>
          <div style={{fontSize:20,fontWeight:700,color:col,marginTop:4}}>{v}</div>
        </div>
      ))}
    </div>
    {staged&&<div style={{fontSize:12,color:WG,marginBottom:18}}>Requesting <strong style={{color:INK}}>{fmt(dueNow)}</strong> now of the <strong style={{color:INK}}>{fmt(balance)}</strong> outstanding · <strong style={{color:INK}}>{fmt(remainingAfter)}</strong> payable later.</div>}
    <Card>
      <label style={SS.lbl}>Amount due now — this request <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
      <div style={{position:"relative",maxWidth:220,marginTop:4}}>
        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
        <input type="number" min="0" step="0.01" value={inv.requestAmount||""} onChange={e=>setRequestAmount(e.target.value)} placeholder={`Full balance: ${fmt(balance)}`}
          style={{...SS.inp,marginTop:0,padding:"9px 10px 9px 24px",textAlign:"right",fontWeight:staged?700:400,borderColor:staged?GOLD:BD}}/>
      </div>
      <div style={{fontSize:11,color:WG,marginTop:8,lineHeight:1.5}}>Set this to request a <strong>specific staged amount</strong> now (e.g. the diamond balance) instead of the full outstanding balance. The invoice and client link will show <strong>"Due now"</strong> with the remainder noted as payable later. Leave blank to request the full balance. {staged&&<button onClick={()=>setRequestAmount("")} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit",marginLeft:4}}>Clear</button>}</div>
      <div style={{fontSize:11,color:GOLD_D,marginTop:8}}>After changing this, click <strong>{ICON_LINK}Copy link</strong> above to refresh what the client sees.</div>
    </Card>
    <Card>
      <label style={SS.lbl}>Discount <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
      <div style={{display:"flex",gap:10,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
        <input value={inv.discountLabel||"Discount"} onChange={e=>setDiscount(discount,e.target.value)} placeholder="Label (e.g. Loyalty discount)" style={{...SS.inp,marginTop:0,flex:1,minWidth:180}}/>
        <div style={{position:"relative",width:170}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>− $</span>
          <input type="number" min="0" step="0.01" value={inv.discount||""} onChange={e=>setDiscount(e.target.value,inv.discountLabel)} placeholder="0.00"
            style={{...SS.inp,marginTop:0,padding:"9px 10px 9px 32px",textAlign:"right",fontWeight:discount>0?700:400,borderColor:discount>0?GOLD:BD}}/>
        </div>
        {discount>0&&<Btn sm ghost onClick={()=>setDiscount(0,inv.discountLabel)}>Clear</Btn>}
      </div>
      {discount>0
        ?<div style={{fontSize:12,color:WG,marginTop:8,lineHeight:1.6}}>Subtotal <strong style={{color:INK}}>{fmt(subtotalIncGST)}</strong> − {(inv.discountLabel||"Discount").toLowerCase()} <strong style={{color:INK}}>{fmt(discount)}</strong> = total <strong style={{color:OK}}>{fmt(inv.totalIncGST)}</strong> inc {TAX_LABEL} ({TAX_LABEL} {fmt(inv.gst)}). Shows as a line on the customer's invoice.</div>
        :<div style={{fontSize:11,color:WG,marginTop:8,lineHeight:1.5}}>Enter an amount to take off the total — it appears as its own line on the customer's invoice, and the total, {TAX_LABEL} and balance recalculate automatically.</div>}
      {discount>0&&<div style={{fontSize:11,color:GOLD_D,marginTop:8}}>After changing this, click <strong>{ICON_LINK}Copy link</strong> above to refresh what the client sees.</div>}
    </Card>
    <Card>
      {hasCustomerLines
        ?<>
          <label style={SS.lbl}>Customer-facing lines <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(one per accepted option — shown on the invoice with the combined total)</span></label>
          <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
            {inv.customerLines.map(l=>(
              <div key={l.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <input defaultValue={l.description} onBlur={e=>setCustomerLineDesc(l.id,e.target.value)} placeholder="Description shown to the customer"
                  style={{...SS.inp,marginTop:0,flex:1}}/>
                <div style={{fontSize:14,fontWeight:700,color:INK,whiteSpace:"nowrap",minWidth:90,textAlign:"right"}}>{fmt(l.amount)}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:WG,marginTop:8,lineHeight:1.5}}>Each option appears as its own line on the customer's invoice, with the prices adding up to the total. Edit the wording so it reads well for the client (e.g. "Platinum wedding band", "18ct yellow gold wedding band"). The internal cost lines below are never shown to the customer.</div>
        </>
        :<>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <label style={SS.lbl}>Customer-facing description (optional)</label>
            <div style={{background:descDraft.trim()?OK+"22":DANGER+"18",color:descDraft.trim()?OK:DANGER,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,letterSpacing:"0.04em"}}>{descDraft.trim()?"SHOWN ON INVOICE":"BLANK — ADD ONE"}</div>
          </div>
          <textarea ref={descRef} value={descDraft} onChange={e=>setDescDraft(e.target.value)} onBlur={commitDesc} rows={3}
            placeholder="e.g. Custom 18ct yellow gold bracelet — design, materials & handcrafting"
            style={{...SS.inp,marginTop:0,resize:"vertical",lineHeight:1.6}}/>
          <div style={{fontSize:11,color:WG,marginTop:6,lineHeight:1.5}}>This is the single line the customer sees on the invoice (with the total). The internal cost lines below are never shown to the customer. <strong>If you leave it blank, the invoice prints no description</strong> — so add what this job is (e.g. "Custom engagement ring", "Ring remodel", "Repair").</div>
        </>}
    </Card>
    <Card>
      {!isMobile&&<div style={{display:"grid",gridTemplateColumns:"1fr 100px 120px",gap:6,marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${BD}`}}>
        {["Item / Description (internal)","Tax",`Amount inc ${TAX_LABEL}`].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
      </div>}
      {isMobile&&<div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6,paddingBottom:8,borderBottom:`1px solid ${BD}`}}>Internal cost breakdown · all lines incl. {TAX_LABEL}</div>}
      {inv.lineItems.map(li=>(isMobile
        ? <div key={li.id} style={{padding:"10px 0",borderBottom:`1px solid ${BD}`,fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline"}}>
              <span style={{fontWeight:600,color:INK,minWidth:0}}>{li.description}</span>
              <span style={{fontWeight:700,color:INK,whiteSpace:"nowrap",flexShrink:0}}>{fmt(lineCostLow(li))}</span>
            </div>
            {li.detail&&<div style={{fontSize:11,color:WG,marginTop:3}}>{li.detail}</div>}
          </div>
        : <div key={li.id} style={{display:"grid",gridTemplateColumns:"1fr 100px 120px",gap:6,padding:"10px 0",borderBottom:`1px solid ${BD}`,fontSize:13,alignItems:"start"}}>
          <div><div style={{fontWeight:600,color:INK}}>{li.description}</div>{li.detail&&<div style={{fontSize:11,color:WG,marginTop:2}}>{li.detail}</div>}</div>
          <div style={{fontSize:11,color:WG,paddingTop:2}}>{TAX_LABEL}</div>
          <div style={{fontWeight:700,color:INK,textAlign:"right"}}>{fmt(lineCostLow(li))}</div>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <div style={{minWidth:isMobile?0:280,width:isMobile?"100%":undefined}}>
          {discount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",color:WG}}><span>Subtotal</span><span>{fmt(subtotalIncGST)}</span></div>}
          {discount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",color:OK}}><span>{inv.discountLabel||"Discount"}</span><span>−{fmt(discount)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",color:WG}}><span>Includes {TAX_LABEL}</span><span>{fmt(inv.gst)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:17,fontWeight:800,color:INK,borderTop:`2px solid ${INK}`,marginTop:8,paddingTop:10}}><span>Total (incl. {TAX_LABEL})</span><span>{fmt(inv.totalIncGST)}</span></div>
          {invTradeIn>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0 2px",color:OK}}><span>Gold trade-in credit</span><span>−{fmt(invTradeIn)}</span></div>}
          {paidTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0 2px",color:OK}}><span>Paid to date</span><span>−{fmt(paidTotal)}</span></div>}
          {(invTradeIn>0||paidTotal>0)&&<div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:800,color:balance>0.5?WARN:OK,marginTop:2}}><span>Balance due</span><span>{fmt(balance)}</span></div>}
        </div>
      </div>
      {inv.notes&&<div style={{marginTop:14,fontSize:13,color:WG,fontStyle:"italic",borderTop:`1px solid ${BD}`,paddingTop:10}}>{inv.notes}</div>}
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"flex-start":"center",gap:isMobile?8:8,marginTop:18}}>
        <span style={{fontSize:11,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Mark as:</span>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["Unpaid","Paid","Overdue"].map(s=><Btn key={s} sm ghost={inv.status!==s} onClick={()=>setStatus(s)}>{inv.status===s?"✓ ":""}{s}</Btn>)}
        </div>
      </div>
      {autoPaid&&<div style={{fontSize:12,color:OK,marginTop:10}}>✓ Automatically marked <strong>Paid</strong> — recorded payments cover this invoice.</div>}
    </Card>
  </div>;
}

function InvoicesList({invoices,jobs,clients,quotes,setQuotes,payments,setInvoices,markupTable,setView,biz}){
  const isMobile=useIsMobile();
  const[modal,setModal]=useState(false);
  const[exportOpen,setExportOpen]=useState(false);
  const[expFrom,setExpFrom]=useState("");
  const[expTo,setExpTo]=useState("");
  // Preset date ranges (AU financial year = 1 Jul–30 Jun).
  const setRange=(preset)=>{
    const now=new Date(),y=now.getFullYear(),m=now.getMonth(),iso=d=>d.toISOString().slice(0,10);
    if(preset==="month"){setExpFrom(iso(new Date(y,m,1)));setExpTo(iso(new Date(y,m+1,0)));}
    else if(preset==="quarter"){const qs=Math.floor(m/3)*3;setExpFrom(iso(new Date(y,qs,1)));setExpTo(iso(new Date(y,qs+3,0)));}
    else if(preset==="fy"){const s=m>=6?y:y-1;setExpFrom(iso(new Date(s,6,1)));setExpTo(iso(new Date(s+1,5,30)));}
    else{setExpFrom("");setExpTo("");}
  };
  const inExpRange=inv=>{const d=String(inv.date||"");return (!expFrom||d>=expFrom)&&(!expTo||d<=expTo);};
  const expCount=invoices.filter(inExpRange).length;
  const[selClient,setSelClient]=useState("");
  const[selJob,setSelJob]=useState("");
  const[selQuotes,setSelQuotes]=useState([]);   // approved quote ids to combine into one invoice
  const clientJobs=selClient?jobs.filter(j=>j.clientId===selClient):[];
  // Trade accounts can bill a quote without approving it first (invoicing confirms it); retail still
  // only offers approved quotes. Keeps parity with the "Invoice this job" flow on the job card.
  const selClientTrade=clients.find(c=>c.id===selClient)?.accountType==="trade";
  const jobQuotes=selJob?quotes.filter(q=>q.jobId===selJob&&(q.status==="Approved"||selClientTrade)&&!quoteHasInvoice(invoices,q.id)):[];
  // Quotes on this job already on an invoice — surfaced (greyed out) so a "missing" option isn't a silent mystery.
  const invoicedQuotes=selJob?quotes.filter(q=>q.jobId===selJob&&(q.status==="Approved"||selClientTrade)&&quoteHasInvoice(invoices,q.id)):[];
  const invoiceForQuote=qid=>invoices.find(i=>(i.quoteIds||(i.quoteId?[i.quoteId]:[])).includes(qid));
  const toggleQuote=qid=>setSelQuotes(p=>p.includes(qid)?p.filter(x=>x!==qid):[...p,qid]);
  const combinedTotal=selQuotes.reduce((s,qid)=>{const q=quotes.find(x=>x.id===qid);return s+(q?quoteGrandTotal(q,markupTable):0);},0);
  const openModal=()=>{setSelClient("");setSelJob("");setSelQuotes([]);setModal(true);};
  const createInv=()=>{
    if(!guardEdit())return;
    const qs=selQuotes.map(id=>quotes.find(x=>x.id===id)).filter(Boolean);
    if(!qs.length)return;
    const jb=jobs.find(j=>j.id===selJob);
    // Trade: promote the billed quotes to Approved so the job/dashboard/statement totals reconcile.
    if(setQuotes){const s=new Set(qs.map(q=>q.id));setQuotes(p=>{const n=p.map(q=>s.has(q.id)&&q.status!=="Approved"?{...q,status:"Approved"}:q);persist(K.qu,n);return n;});}
    const inv=buildCombinedInvoice(qs,jb,invoices,markupTable,biz);
    setInvoices(p=>{const n=[...p,inv];persist(K.inv,n);return n;});
    declineOrphanApprovedQuotes(selJob,qs.map(q=>q.id),quotes,invoices,setQuotes,markupTable);
    setModal(false);
    setView("invoiceDetail_"+inv.id);
  };
  const delInv=(id,e)=>{e.stopPropagation();const iv=invoices.find(x=>x.id===id);if(!confirm(`Delete invoice ${iv?.number||""}? This can't be undone. Payments and the quote are not affected.`))return;setInvoices(p=>{const n=p.filter(x=>x.id!==id);persist(K.inv,n);return n;});};
  // True net invoice figures. Payments are job-level, so distribute each job's received cash
  // across its invoices (oldest first), netting each invoice's gold trade-in credit first.
  // Result: Total invoiced = Collected (cash + trade-ins) + Outstanding, so the three reconcile.
  let grossInvoiced=0,totalPaid=0,totalOut=0;
  {
    const byJob={};
    invoices.forEach(i=>{(byJob[i.jobId]=byJob[i.jobId]||[]).push(i);});
    Object.keys(byJob).forEach(jid=>{
      let cash=payments.filter(p=>p.jobId===jid&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
      byJob[jid].slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(inv=>{
        const gross=Number(inv.totalIncGST)||0;
        const afterTradeIn=Math.max(0,gross-(Number(inv.tradeInCredit)||0));
        const cashApplied=Math.min(cash,afterTradeIn);
        cash-=cashApplied;
        const bal=Math.max(0,afterTradeIn-cashApplied);
        grossInvoiced+=gross;
        totalPaid+=gross-bal;   // trade-in credit + cash applied = value received against this invoice
        totalOut+=bal;
      });
    });
  }
  // Export all invoices to a CSV your accountant / MYOB / Xero can import (ex-GST, GST, total,
  // paid, balance). Payments are job-level, so distribute each job's cash across its invoices
  // oldest-first — same rule as the summary tiles — for accurate per-invoice paid/balance.
  const exportCsv=()=>{
    const{paidMap,balMap}=invoicePaidBalanceMap(invoices,payments);
    const rows=invoices.filter(inExpRange).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)))
      .map(inv=>invoiceCsvRow(inv,{jobs,clients,payments,allInvoices:invoices,paidMap,balMap}));
    const span=expFrom||expTo?`${expFrom||"start"}_to_${expTo||"end"}`:"all";
    downloadInvoiceCsv(rows,`invoices-${span}.csv`);
  };
  return <div>
    <SectionHeader eyebrow="Billing" title="Invoices" subtitle="Send, track and reconcile every invoice — paid, outstanding and overdue." action={<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>{invoices.length>0&&<Btn ghost onClick={()=>setExportOpen(true)}>{ICON_CSV}Export CSV</Btn>}<Btn onClick={openModal}>+ New Invoice</Btn></div>}/>
    {exportOpen&&<Modal title="Export invoices to CSV" onClose={()=>setExportOpen(false)}>
      <div style={{fontSize:13,color:WG,marginBottom:14,lineHeight:1.6}}>Pick a date range (by invoice date) for your bookkeeping, or leave both blank to export everything.</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {[["This month","month"],["This quarter","quarter"],["Financial year","fy"],["All time","all"]].map(([lbl,p])=>(
          <button key={p} onClick={()=>setRange(p)} style={{padding:"7px 13px",borderRadius:4,border:`1px solid ${BD}`,background:WHITE,color:INK,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
        <div><label style={SS.lbl}>From</label><input type="date" value={expFrom} onChange={e=>setExpFrom(e.target.value)} style={{...SS.inp,marginTop:6,width:180}}/></div>
        <div><label style={SS.lbl}>To</label><input type="date" value={expTo} onChange={e=>setExpTo(e.target.value)} style={{...SS.inp,marginTop:6,width:180}}/></div>
      </div>
      <div style={{fontSize:13,color:expCount?INK:WG,fontWeight:600,marginBottom:16}}>{expCount} invoice{expCount!==1?"s":""} in this range.</div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
        <Btn sm ghost onClick={()=>setExportOpen(false)}>Cancel</Btn>
        <Btn sm onClick={()=>{exportCsv();setExportOpen(false);}} disabled={!expCount}>Export {expCount||""} invoice{expCount!==1?"s":""}</Btn>
      </div>
    </Modal>}
    {invoices.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
      {[["Total invoiced",fmt(grossInvoiced),INK],["Outstanding",fmt(totalOut),totalOut>0?WARN:OK],["Collected",fmt(totalPaid),OK]].map(([l,v,col])=>(
        <div key={l} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:4,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div>
          <div style={{fontSize:20,fontWeight:700,color:col,marginTop:4}}>{v}</div>
        </div>
      ))}
    </div>}
    {invoices.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"24px 0"}}>
      <div style={{fontSize:32,marginBottom:10}}>🧾</div>
      <div style={{fontWeight:600,color:INK,marginBottom:6}}>No invoices yet</div>
      <div style={{marginBottom:16}}>Create your first invoice from an approved quote.</div>
      <Btn onClick={openModal}>+ Create Invoice</Btn>
    </div></Card>}
    {invoices.slice().reverse().map(inv=>{
      const job=jobs.find(j=>j.id===inv.jobId);
      const cl=job?clients.find(x=>x.id===job.clientId):null;
      const paid=(payments||[]).filter(p=>p.jobId===inv.jobId&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
      const bal=Math.max(0,inv.totalIncGST-(Number(inv.tradeInCredit)||0)-paid);   // net of gold trade-in
      const es=invoiceEffectiveStatus(inv,payments,invoices);
      return <Card key={inv.id} onClick={()=>setView("invoiceDetail_"+inv.id)}>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"center",gap:isMobile?10:0}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:15,color:INK}}>{inv.number}</div>
            <div style={{fontSize:13,color:WG,marginTop:3}}>{job?.type} · {cl?.name} · {fmtDate(inv.date)}</div>
            {bal>0&&es!=="Paid"&&<div style={{fontSize:12,color:WARN,marginTop:2,fontWeight:600}}>Balance owing: {fmt(bal)}</div>}
          </div>
          <div style={{display:"flex",gap:14,alignItems:"center",justifyContent:isMobile?"space-between":"flex-start",flexShrink:0}}>
            <Badge label={es} color={es==="Paid"?OK:es==="Overdue"?DANGER:WARN}/>
            <div style={{fontWeight:800,fontSize:17,color:INK,textAlign:"right"}}>
              {fmt(inv.totalIncGST)}<div style={{fontSize:11,color:WG,fontWeight:400}}>inc {TAX_LABEL}</div>
            </div>
            <Btn sm danger onClick={e=>delInv(inv.id,e)}>×</Btn>
          </div>
        </div>
      </Card>;
    })}
    {modal&&<Modal title="New Invoice" onClose={()=>setModal(false)}>
      <div style={{marginBottom:6,fontSize:13,color:WG,lineHeight:1.6}}>Create an invoice from one quote — or tick several from the same job to combine them into a single invoice (handy when a client accepts more than one option). {selClientTrade?"Trade account — quotes don't need approving first; invoicing confirms them.":"Only approved quotes without an existing invoice are shown."}</div>
      <div style={{height:1,background:BD,margin:"14px 0"}}/>
      <div style={{marginBottom:14}}>
        <label style={SS.lbl}>Client</label>
        <select value={selClient} onChange={e=>{setSelClient(e.target.value);setSelJob("");setSelQuotes([]);}} style={{...SS.inp,marginTop:4}}>
          <option value="">— Select client —</option>
          {clients.filter(cl=>jobs.some(j=>j.clientId===cl.id&&quotes.some(q=>q.jobId===j.id&&(q.status==="Approved"||cl.accountType==="trade")&&!quoteHasInvoice(invoices,q.id)))).map(cl=><option key={cl.id} value={cl.id}>{cl.name}</option>)}
        </select>
      </div>
      {selClient&&<div style={{marginBottom:14}}>
        <label style={SS.lbl}>Job</label>
        <select value={selJob} onChange={e=>{setSelJob(e.target.value);setSelQuotes([]);}} style={{...SS.inp,marginTop:4}}>
          <option value="">— Select job —</option>
          {clientJobs.filter(j=>quotes.some(q=>q.jobId===j.id&&(q.status==="Approved"||selClientTrade)&&!quoteHasInvoice(invoices,q.id))).map(j=><option key={j.id} value={j.id}>{j.type} · {j.stage}</option>)}
        </select>
      </div>}
      {selJob&&<div style={{marginBottom:18}}>
        <label style={SS.lbl}>Approved quotes to invoice <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(tick one, or several to combine into one invoice)</span></label>
        {jobQuotes.length===0&&invoicedQuotes.length===0?<div style={{background:"#FFF8E1",border:"1px solid #F0C040",borderRadius:4,padding:"10px 14px",fontSize:13,color:WARN,marginTop:6}}>No approved quotes without an invoice. Go to the job and approve a quote first.</div>
        :<div style={{marginTop:6,display:"flex",flexDirection:"column",gap:8}}>
          {jobQuotes.map(q=>{
            const on=selQuotes.includes(q.id);
            return <button key={q.id} onClick={()=>toggleQuote(q.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",border:`1px solid ${on?GOLD:BD}`,borderRadius:4,background:on?GOLD_L+"55":WHITE,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${on?GOLD:BD}`,background:on?GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:WHITE,fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,color:INK}}>{quoteLabel(q)}</div>{quoteIsManual(q)&&<div style={{fontSize:11,color:GOLD_D,fontWeight:600}}>Manual quoted price</div>}</div>
              <div style={{fontWeight:800,fontSize:13,color:INK,whiteSpace:"nowrap"}}>{fmtR(quoteGrandTotal(q,markupTable))}<span style={{fontSize:10,color:WG,fontWeight:400}}> inc {TAX_LABEL}</span></div>
            </button>;
          })}
          {selQuotes.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4,padding:"11px 14px",background:OK+"11",border:`1px solid ${OK}44`,borderRadius:4}}>
            <span style={{fontSize:12,color:WG}}>Invoice <strong style={{color:INK}}>{nextInvoiceNumber(invoices,biz)}</strong> · {selQuotes.length} quote{selQuotes.length!==1?"s":""}{selQuotes.length>1?" combined":""}</span>
            <span style={{fontSize:16,fontWeight:800,color:OK}}>{fmtR(combinedTotal)}<span style={{fontSize:11,color:WG,fontWeight:400}}> inc {TAX_LABEL}</span></span>
          </div>}
          {invoicedQuotes.length>0&&<div style={{marginTop:jobQuotes.length?8:2}}>
            <div style={{fontSize:11,color:WG,lineHeight:1.5,marginBottom:6}}>Already on an invoice — delete that invoice first to include it in a combined one.</div>
            {invoicedQuotes.map(q=>{const iv=invoiceForQuote(q.id);return <div key={q.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",border:`1px dashed ${BD}`,borderRadius:4,background:PARCH,opacity:0.75,marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,color:WG,textDecoration:"line-through"}}>{quoteLabel(q)}</div><div style={{fontSize:11,color:WG,fontWeight:600}}>On invoice {iv?.number||"—"}{iv&&<button onClick={()=>{setModal(false);setView("invoiceDetail_"+iv.id);}} style={{background:"none",border:"none",padding:"0 0 0 6px",color:GOLD_D,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>view</button>}</div></div>
              <div style={{fontWeight:800,fontSize:13,color:WG,whiteSpace:"nowrap"}}>{fmtR(quoteGrandTotal(q,markupTable))}<span style={{fontSize:10,color:WG,fontWeight:400}}> inc {TAX_LABEL}</span></div>
            </div>;})}
          </div>}
        </div>}
      </div>}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn ghost onClick={()=>setModal(false)}>Cancel</Btn>
        <Btn disabled={!selQuotes.length} onClick={createInv}>{selQuotes.length>1?`Create combined invoice (${selQuotes.length})`:"Create Invoice"}</Btn>
      </div>
    </Modal>}
  </div>;
}

// ── Trade statements ──────────────────────────────────────────────────────
// Aged-receivables overview across every trade account + a link into each account's statement.
// Trade-only: retail clients bill per invoice; trade accounts settle by consolidated statement.
function StatementsList({clients,jobs,invoices,payments,biz,setView}){
  const isMobile=useIsMobile();
  const asOf=today();
  const trade=(clients||[]).filter(c=>c.accountType==="trade");
  // Each trade account with its aged analysis, heaviest debtors first. Only accounts with billing
  // activity (any invoice, received payment, or a balance) are listed — a brand-new trade account,
  // or one whose jobs were all deleted, drops off rather than lingering at $0. Its statement is
  // still reachable from the client's page.
  const rows=trade.map(c=>{
    const act=accountActivity(c,jobs,invoices,payments);
    const aging=accountAging(c,jobs,invoices,payments,asOf);
    return {c,aging,hasActivity:act.invoices.length>0||act.payments.length>0||aging.total>0};
  }).filter(r=>r.hasActivity).sort((a,b)=>b.aging.total-a.aging.total);
  const totals=rows.reduce((acc,{aging})=>{AGE_BUCKETS.forEach(([k])=>acc[k]+=aging.buckets[k]);acc.total+=aging.total;return acc;},{current:0,d1_30:0,d31_60:0,d61_90:0,d90:0,total:0});
  const bucketColor=k=>k==="d90"?DANGER:k==="d61_90"?WARN:k==="d31_60"?WARN:INK;
  return <div>
    <SectionHeader eyebrow="Billing" title="Trade statements" subtitle="One consolidated statement per trade account — with a live account ledger and aged receivables (30/60/90)."/>
    {rows.length===0
      ? <Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"24px 0"}}>
          <div style={{fontSize:32,marginBottom:10}}>🧾</div>
          {trade.length===0
            ? <><div style={{fontWeight:600,color:INK,marginBottom:6}}>No trade accounts yet</div>
                <div style={{marginBottom:16,lineHeight:1.6,maxWidth:420,margin:"0 auto 16px"}}>Set a client's account type to <strong>Trade</strong> (with terms like Net 30 / EOM) and their completed jobs roll up into a single monthly statement here.</div>
                <Btn onClick={()=>setView("clients")}>Go to Clients</Btn></>
            : <><div style={{fontWeight:600,color:INK,marginBottom:6}}>No trade billing yet</div>
                <div style={{marginBottom:16,lineHeight:1.6,maxWidth:440,margin:"0 auto 16px"}}>You have {trade.length} trade account{trade.length!==1?"s":""}, but none have been invoiced yet. Invoice a trade job and it'll appear here as a statement.</div>
                <Btn onClick={()=>setView("invoices")}>Go to Invoices</Btn></>}
        </div></Card>
      : <>
        <div style={{...SS.lbl,marginBottom:10,display:"flex",alignItems:"center"}}>Aged receivables — all trade accounts<InfoDot text="How much your trade accounts owe, split by how overdue it is — Current (not yet due) through 90+ days. The older a bucket, the more urgent to chase. Click any account below for its full statement and ledger."/></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(122px,1fr))",gap:10,marginBottom:18}}>
          {[["Total owing",totals.total,totals.total>0?WARN:OK],...AGE_BUCKETS.map(([k,l])=>[l,totals[k],bucketColor(k)])].map(([l,v,col],i)=>(
            <div key={l} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:8,padding:"13px 14px"}}>
              <div style={{fontSize:9.5,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
              <div style={{fontSize:i===0?19:16,fontWeight:800,color:col,marginTop:4}}>{fmtR(v)}</div>
            </div>
          ))}
        </div>
        {rows.map(({c,aging})=>{
          const over=Number(c.creditLimit)>0&&aging.total>Number(c.creditLimit);
          return <Card key={c.id} onClick={()=>setView("statementDetail_"+c.id)}>
            <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"center",gap:isMobile?10:0}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15,color:INK,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{clientDisplayName(c)}
                  {c.terms&&<span style={{fontSize:9,fontWeight:800,letterSpacing:"0.08em",color:GOLD_D,background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:999,padding:"2px 7px",textTransform:"uppercase"}}>{c.terms}</span>}
                  {over&&<span style={{fontSize:9,fontWeight:800,letterSpacing:"0.06em",color:"#fff",background:DANGER,borderRadius:999,padding:"2px 7px",textTransform:"uppercase"}}>Over limit</span>}
                </div>
                <div style={{fontSize:12,color:WG,marginTop:3}}>{c.contactName||c.email||"—"}{aging.buckets.d90>0?<span style={{color:DANGER,fontWeight:600}}> · {fmtR(aging.buckets.d90)} over 90 days</span>:aging.total>aging.buckets.current?<span style={{color:WARN,fontWeight:600}}> · {fmtR(aging.total-aging.buckets.current)} overdue</span>:null}</div>
              </div>
              <div style={{display:"flex",gap:14,alignItems:"center",justifyContent:isMobile?"space-between":"flex-start",flexShrink:0}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,fontSize:17,color:aging.total>0?INK:OK}}>{fmt(aging.total)}</div>
                  <div style={{fontSize:11,color:WG}}>{aging.total>0?"owing":"settled"}</div>
                </div>
                <span title="Open statement" aria-label="Open statement" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:999,background:GOLD_L,border:`1px solid ${GOLD}55`,color:GOLD_D,flexShrink:0}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                </span>
              </div>
            </div>
          </Card>;
        })}
      </>}
  </div>;
}

// Per-account statement of account: header, period picker, running-balance ledger, aged
// receivables, and Print / CSV export. All figures derive from invoices+payments (no new entity).
function StatementDetail({clientId,clients,jobs,invoices,payments,biz,setView}){
  const isMobile=useIsMobile();
  const isNarrow=useIsMobile(1024);   // tablet + phone: stack the fixed-column ledger table
  const c=(clients||[]).find(x=>x.id===clientId);
  const[preset,setPreset]=useState("all");
  const[from,setFrom]=useState("");
  const[to,setTo]=useState("");
  const setRange=(p)=>{
    const now=new Date(),y=now.getFullYear(),m=now.getMonth(),iso=d=>toISO(d);
    if(p==="month"){setFrom(iso(new Date(y,m,1)));setTo(iso(new Date(y,m+1,0)));}
    else if(p==="lastmonth"){setFrom(iso(new Date(y,m-1,1)));setTo(iso(new Date(y,m,0)));}
    else if(p==="quarter"){const qs=Math.floor(m/3)*3;setFrom(iso(new Date(y,qs,1)));setTo(iso(new Date(y,qs+3,0)));}
    else if(p==="fy"){const s=m>=6?y:y-1;setFrom(iso(new Date(s,6,1)));setTo(iso(new Date(s+1,5,30)));}
    else{setFrom("");setTo("");}
    setPreset(p);
  };
  if(!c)return <div><Btn ghost sm onClick={()=>setView("statements")}>← Statements</Btn><Card><div style={{color:WG,padding:20}}>Account not found.</div></Card></div>;
  const asOf=today();
  const st=accountStatement(c,jobs,invoices,payments,{from,to});
  const aging=accountAging(c,jobs,invoices,payments,asOf);
  const m=accountMetrics(c,jobs,invoices,payments);
  const over=Number(c.creditLimit)>0&&aging.total>Number(c.creditLimit);
  const bucketColor=k=>k==="d90"?DANGER:k==="d61_90"||k==="d31_60"?WARN:INK;
  const doPrint=()=>printStatement(biz,c,{...st,aging,from,to});
  const doCsv=()=>{const span=from||to?`${from||"start"}_to_${to||"today"}`:"all";downloadStatementCsv(c,st.opening,st.period,st.closing,`statement-${(clientDisplayName(c)||"account").replace(/[^\w-]+/g,"-")}-${span}.csv`);};
  const presets=[["This month","month"],["Last month","lastmonth"],["This quarter","quarter"],["Financial year","fy"],["All","all"]];
  const info=[["Contact",c.contactName],["Email",c.email],["Phone",c.phone],[TAX_ID_LABEL,c.abn],["Terms",c.terms],["Credit limit",c.creditLimit?fmt(Number(c.creditLimit)):""]].filter(([,v])=>v);
  return <div>
    <Btn ghost sm onClick={()=>setView("statements")}>← Statements</Btn>
    <div style={{height:12}}/>
    <Card>
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"stretch":"flex-start",gap:14}}>
        <div style={{minWidth:0}}>
          <h1 style={{margin:0,fontSize:isMobile?19:23,fontWeight:800,color:INK,letterSpacing:"-0.02em",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>{clientDisplayName(c)}
            <span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",color:GOLD_D,background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:999,padding:"3px 9px",textTransform:"uppercase"}}>Trade account</span>
          </h1>
          <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:"2px 16px"}}>
            {info.map(([k,v])=><span key={k} style={{fontSize:12.5,color:WG}}>{k}: <span style={{color:INK,fontWeight:600}}>{v}</span></span>)}
          </div>
        </div>
        <div style={{textAlign:isMobile?"left":"right",flexShrink:0}}>
          <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Balance owing</div>
          <div style={{fontSize:26,fontWeight:800,color:aging.total>0?INK:OK}}>{fmt(aging.total)}</div>
        </div>
      </div>
      {over&&<div style={{marginTop:14,background:DANGER+"12",border:`1px solid ${DANGER}55`,borderRadius:8,padding:"10px 14px",fontSize:13,color:DANGER,fontWeight:600}}>⚠ Over credit limit — owing {fmt(aging.total)} against a {fmt(Number(c.creditLimit))} limit.</div>}
    </Card>

    <Card>
      <div style={{...SS.lbl,marginBottom:12}}>Account overview <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(all time)</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        {[
          ["Jobs",String(m.jobCount),`${m.activeJobs} active`,INK],
          ["Invoiced",fmtR(m.invoiced),`${m.invoiceCount} invoice${m.invoiceCount!==1?"s":""}`,INK],
          ["Collected",fmtR(m.collected),"received",OK],
          ["Outstanding",fmtR(m.outstanding),"owing",m.outstanding>0?WARN:OK],
          ["Avg turnaround",m.avgTurnaround!=null?`${m.avgTurnaround}d`:"—",m.completedCount?`${m.completedCount} completed`:"no completed jobs",INK],
        ].map(([l,v,sub,col])=>(
          <div key={l} style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:8,padding:"12px 13px"}}>
            <div style={{fontSize:9.5,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            <div style={{fontSize:18,fontWeight:800,color:col,marginTop:3}}>{v}</div>
            <div style={{fontSize:10.5,color:WG,marginTop:1}}>{sub}</div>
          </div>
        ))}
      </div>
    </Card>

    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:12}}>
        <div style={SS.lbl}>Statement period</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn sm ghost onClick={doCsv}>{ICON_CSV}Export CSV</Btn>
          <Btn sm onClick={doPrint}>{ICON_PRINT}Print / Save PDF</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {presets.map(([lbl,p])=>(
          <button key={p} onClick={()=>setRange(p)} style={{padding:"7px 13px",borderRadius:8,border:`1.5px solid ${preset===p?GOLD:BD}`,background:preset===p?GOLD_L:WHITE,color:preset===p?GOLD_D:INK,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:4}}>
        <div><label style={SS.lbl}>From</label><input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPreset("custom");}} style={{...SS.inp,marginTop:6,width:170}}/></div>
        <div><label style={SS.lbl}>To</label><input type="date" value={to} onChange={e=>{setTo(e.target.value);setPreset("custom");}} style={{...SS.inp,marginTop:6,width:170}}/></div>
      </div>
    </Card>

    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"12px 14px",background:PARCH,border:`1px solid ${BD}`,borderRadius:9}}>
        <span style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.07em"}}>Opening balance</span>
        <span style={{fontSize:15,fontWeight:800,color:INK}}>{fmt(st.opening)}</span>
      </div>
      {!isNarrow&&<div style={{display:"grid",gridTemplateColumns:"90px 1fr 110px 130px 120px",gap:8,padding:"12px 14px 6px",fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>
        <div>Date</div><div>Description</div><div style={{textAlign:"right"}}>Charges</div><div style={{textAlign:"right"}}>Payments</div><div style={{textAlign:"right"}}>Balance</div>
      </div>}
      {st.period.length===0&&<div style={{color:WG,fontSize:13,padding:"20px 14px",fontStyle:"italic",textAlign:"center"}}>No transactions in this period.</div>}
      {st.period.map((e,i)=>(
        <div key={e.id} style={isNarrow
          ?{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,padding:"12px 14px",borderTop:i>0?`1px solid ${BD}`:"none"}
          :{display:"grid",gridTemplateColumns:"90px 1fr 110px 130px 120px",gap:8,padding:"12px 14px",borderTop:`1px solid ${BD}`,alignItems:"center"}}>
          <div style={{fontSize:12,color:WG,whiteSpace:"nowrap"}}>{fmtDate(e.date)}</div>
          <div style={{minWidth:0,order:isNarrow?3:0,flexBasis:isNarrow?"100%":"auto"}}>
            <div style={{fontSize:13,color:INK,fontWeight:600}}>{e.desc}{e.ref&&<span style={{color:WG,fontWeight:400}}> · {e.ref}</span>}</div>
            {(e.po||(e.kind==="invoice"&&e.due))&&<div style={{fontSize:11,color:WG,marginTop:1}}>{e.po?`PO ${e.po}`:""}{e.po&&e.kind==="invoice"&&e.due?" · ":""}{e.kind==="invoice"&&e.due?`Due ${fmtDate(e.due)}`:""}</div>}
          </div>
          <div style={{fontSize:13,textAlign:"right",color:INK,fontWeight:e.charge?700:400}}>{e.charge?fmt(e.charge):(isNarrow?"":"—")}</div>
          <div style={{fontSize:13,textAlign:"right",color:e.credit?OK:WG,fontWeight:e.credit?700:400}}>{e.credit?fmt(e.credit):(isNarrow?"":"—")}</div>
          <div style={{fontSize:13,textAlign:"right",fontWeight:700,color:INK}}>{fmt(e.balance)}</div>
        </div>
      ))}
      {(()=>{const settled=st.closing<=0.005;return(
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"15px 16px",marginTop:10,background:settled?OK:INK,borderRadius:10}}>
        <span style={{fontSize:11.5,fontWeight:800,color:"#fff",textTransform:"uppercase",letterSpacing:"0.07em"}}>{settled?"Balance settled":"Closing balance owing"}</span>
        <span style={{fontSize:20,fontWeight:800,color:"#fff"}}>{fmt(st.closing)}</span>
      </div>);})()}
    </Card>

    <Card>
      <div style={{...SS.lbl,marginBottom:12,display:"flex",alignItems:"center"}}>Aged receivables <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,marginLeft:5}}>(as at {fmtDate(asOf)})</span><InfoDot text="This account's outstanding balance split by age — Current (not yet due per the account's terms) through 90+ days overdue. Driven by each invoice's due date."/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        {AGE_BUCKETS.map(([k,l])=>(
          <div key={k} style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:8,padding:"12px 13px"}}>
            <div style={{fontSize:9.5,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            <div style={{fontSize:16,fontWeight:800,color:aging.buckets[k]>0?bucketColor(k):WG,marginTop:4}}>{fmt(aging.buckets[k])}</div>
          </div>
        ))}
      </div>
    </Card>
  </div>;
}

// ── Pricing DB ────────────────────────────────────────────────────────────
const DIAMOND_CAT_LABELS={
  "Lab Grown Diamonds | D-E":"Lab-grown accent diamonds · D-E · VS · Round brilliant · per stone (AUD)",
  "Natural diamonds G-H SI1":"Natural diamonds · G-H · SI1 · Round brilliant · per stone (AUD) · Tax exempt",
  "Natural diamonds D-E VS":"Natural diamonds · D-E · VS · Round brilliant · per stone (AUD) · Tax exempt",
};

function DiamondTable({items,onQtyChange,onSavePrices}){
  const[qtys,setQtys]=useState({});
  const[editing,setEditing]=useState(false);
  const[editStone,setEditStone]=useState({});   // per-stone cost (baseCost) being edited
  const[editPct,setEditPct]=useState({});        // per-carat price being edited (kept in sync)
  const round2=x=>Math.round((Number(x)||0)*100)/100;
  const setQty=(id,v)=>{
    setQtys(p=>({...p,[id]:v}));
    const item=items.find(x=>x.id===id);
    if(item&&onQtyChange)onQtyChange(id,v,{...item,name:`${item.category} ${item.sizeMm}mm`});
  };
  const sorted=[...items].sort((a,b)=>a.sizeMm-b.sizeMm);
  const startEdit=()=>{const s={},p={};sorted.forEach(i=>{s[i.id]=String(i.baseCost);p[i.id]=i.caratWeight>0?String(round2(i.baseCost/i.caratWeight)):"";});setEditStone(s);setEditPct(p);setEditing(true);};
  const cancelEdit=()=>{setEditing(false);setEditStone({});setEditPct({});};
  // Per stone and per ct are linked (carat weight is fixed), so editing one recomputes the other.
  const changeStone=(id,v,ct)=>{setEditStone(m=>({...m,[id]:v}));setEditPct(m=>({...m,[id]:(v!==""&&ct>0)?String(round2(Number(v)/ct)):""}));};
  const changePct=(id,v,ct)=>{setEditPct(m=>({...m,[id]:v}));setEditStone(m=>({...m,[id]:v!==""?String(round2(Number(v)*ct)):""}));};
  const saveEdit=()=>{
    const updated=items.map(x=>{const base=Number(editStone[x.id]??x.baseCost)||0;const pct=x.caratWeight>0?(Number(editPct[x.id])||round2(base/x.caratWeight)):(Number(x.pricePerCarat)||0);return{...x,baseCost:base,pricePerCarat:pct};});
    onSavePrices(updated);setEditing(false);setEditStone({});setEditPct({});
  };
  const dcols="64px 78px 96px 92px 72px 92px";
  const half=Math.ceil(sorted.length/2);
  const groups=[sorted.slice(0,half),sorted.slice(half)];
  const Header=()=><div style={{display:"grid",gridTemplateColumns:dcols,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
    {["Size","Carat","Per stone","Per ct","Qty","Total"].map(h=>(
      <div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>
    ))}
  </div>;
  const Row=(item,i,len)=>{
    const qty=qtys[item.id]||"";
    const total=qty&&Number(qty)>0?item.baseCost*Number(qty):null;
    const inpStyle={width:"84px",padding:"5px 8px",borderRadius:7,border:`1px solid ${GOLD}`,fontSize:13,fontFamily:"inherit",color:GOLD_D,fontWeight:700,background:GOLD_L,outline:"none",textAlign:"right"};
    return <div key={item.id} style={{display:"grid",gridTemplateColumns:dcols,padding:"8px 16px",borderBottom:i<len-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"66"}}>
      <div style={{fontWeight:700,fontSize:13,color:INK}}>{item.sizeMm}mm</div>
      <div style={{fontSize:13,color:WG}}>{item.caratWeight}ct</div>
      {editing
        ?<input type="number" value={editStone[item.id]||""} min="0" step="0.01" onChange={e=>changeStone(item.id,e.target.value,item.caratWeight)} style={inpStyle}/>
        :<div style={{fontSize:13,fontWeight:700,color:INK}}>{fmt(item.baseCost)}</div>}
      {editing
        ?<input type="number" value={editPct[item.id]||""} min="0" step="0.01" onChange={e=>changePct(item.id,e.target.value,item.caratWeight)} style={inpStyle}/>
        :<div style={{fontSize:12,color:WG}}>{fmt(item.caratWeight>0?item.baseCost/item.caratWeight:0)}</div>}
      <input type="number" value={qty} min="1" step="1" onChange={e=>setQty(item.id,e.target.value)} placeholder="0"
        disabled={editing}
        style={{width:"60px",padding:"5px 8px",borderRadius:7,border:`1px solid ${qty&&!editing?GOLD:BD}`,fontSize:13,fontFamily:"inherit",color:INK,background:editing?"#f5f5f5":WHITE,outline:"none",textAlign:"right",opacity:editing?0.4:1}}/>
      <div style={{fontSize:13,fontWeight:800,color:total&&!editing?OK:WG,textAlign:"right",paddingRight:4}}>{total&&!editing?fmt(total):"—"}</div>
    </div>;
  };
  return <div style={{background:WHITE,borderRadius:5,border:`1px solid ${editing?GOLD:BD}`,overflow:"hidden",transition:"border-color 0.15s"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:editing?GOLD_L:PARCH,borderBottom:`1px solid ${editing?GOLD+"55":BD}`}}>
      <div style={{fontSize:11,fontWeight:700,color:editing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>{editing?"Editing prices · edit per stone or per ct, the other follows":"Per stone / per ct cost · click ✎ to edit"}</div>
      <div style={{display:"flex",gap:8}}>
        {editing?<><Btn sm ghost onClick={cancelEdit}>Cancel</Btn><Btn sm onClick={saveEdit}>Save prices</Btn></>
          :<Btn sm ghost onClick={startEdit}>✎ Edit prices</Btn>}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(500px,1fr))"}}>
      {groups.map((g,gi)=><div key={gi} style={{borderLeft:gi>0?`1px solid ${BD}`:"none"}}>
        <Header/>
        {g.map((item,i)=>Row(item,i,g.length))}
      </div>)}
    </div>
  </div>;
}

function SettingTable({items,onSavePrices,label="Basic Setting",onQtyChange}){
  const[qtys,setQtys]=useState({});
  const[editing,setEditing]=useState(false);
  const[editPrices,setEditPrices]=useState({});
  const setQty=(id,v)=>{
    setQtys(p=>({...p,[id]:v}));
    const item=items.find(x=>x.id===id);
    if(item&&onQtyChange)onQtyChange(id,v,{...item,name:`${label} ${item.sizeMm}mm`});
  };
  const sorted=[...items].sort((a,b)=>a.sizeMm-b.sizeMm);

  const startEdit=()=>{
    const initial={};
    sorted.forEach(item=>{initial[item.id]=String(item.baseCost);});
    setEditPrices(initial);
    setEditing(true);
  };
  const cancelEdit=()=>{setEditing(false);setEditPrices({});};
  const saveEdit=()=>{
    const updated=items.map(item=>({
      ...item,
      baseCost:Number(editPrices[item.id]??item.baseCost),
    }));
    onSavePrices(updated);
    setEditing(false);
    setEditPrices({});
  };

  const cols=editing
    ?"66px 96px 120px 1fr"
    :"66px 96px 104px 70px 92px";
  const headers=editing
    ?["Size","Fits (ct)","Setting cost (edit)",""]
    :["Size","Fits (ct)","Setting cost","Qty","Total"];
  const half=Math.ceil(sorted.length/2);
  const groups=[sorted.slice(0,half),sorted.slice(half)];
  const Header=()=><div style={{display:"grid",gridTemplateColumns:cols,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
    {headers.map((h,hi)=>(
      <div key={hi} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>
    ))}
  </div>;
  const Row=(item,i,len)=>{
    const qty=qtys[item.id]||"";
    const displayCost=editing?Number(editPrices[item.id]??item.baseCost):item.baseCost;
    const total=!editing&&qty&&Number(qty)>0?item.baseCost*Number(qty):null;
    return <div key={item.id} style={{display:"grid",gridTemplateColumns:cols,padding:"7px 16px",borderBottom:i<len-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"66"}}>
      <div style={{fontWeight:700,fontSize:13,color:INK}}>{item.sizeMm}mm</div>
      <div style={{fontSize:13,color:WG}}>{item.caratWeight}ct</div>
      {editing
        ?<input type="number" value={editPrices[item.id]??""} min="0" step="0.01"
            onChange={e=>setEditPrices(p=>({...p,[item.id]:e.target.value}))}
            style={{width:"100px",padding:"5px 8px",borderRadius:7,border:`1px solid ${GOLD}`,fontSize:13,fontFamily:"inherit",color:INK,background:WHITE,outline:"none",textAlign:"right",fontWeight:700}}/>
        :<div style={{fontSize:13,fontWeight:700,color:INK}}>{fmt(displayCost)}</div>}
      {editing
        ?<div style={{fontSize:11,color:WG,paddingLeft:4}}>per stone</div>
        :<>
          <input type="number" value={qty} min="1" step="1" onChange={e=>setQty(item.id,e.target.value)} placeholder="0"
            style={{width:"60px",padding:"5px 8px",borderRadius:7,border:`1px solid ${qty?GOLD:BD}`,fontSize:13,fontFamily:"inherit",color:INK,background:WHITE,outline:"none",textAlign:"right"}}/>
          <div style={{fontSize:13,fontWeight:800,color:total?OK:WG,textAlign:"right",paddingRight:4}}>{total?fmt(total):"—"}</div>
        </>}
    </div>;
  };

  return <div style={{background:WHITE,borderRadius:5,border:`1px solid ${editing?GOLD:BD}`,overflow:"hidden",transition:"border-color 0.15s"}}>
    {/* Toolbar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:editing?GOLD_L:PARCH,borderBottom:`1px solid ${editing?GOLD+"55":BD}`,transition:"background 0.15s"}}>
      <div style={{fontSize:11,fontWeight:700,color:editing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>
        {editing?"Editing prices — change any value then save":label+" · "+sorted.length+" sizes"}
      </div>
      <div style={{display:"flex",gap:8}}>
        {editing
          ?<><Btn sm ghost onClick={cancelEdit}>Cancel</Btn><Btn sm onClick={saveEdit}>Save prices</Btn></>
          :<Btn sm ghost onClick={startEdit}>✎ Edit prices</Btn>}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(460px,1fr))"}}>
      {groups.map((g,gi)=><div key={gi} style={{borderLeft:gi>0?`1px solid ${BD}`:"none"}}>
        <Header/>
        {g.map((item,i)=>Row(item,i,g.length))}
      </div>)}
    </div>
    {editing&&<div style={{padding:"12px 16px",background:GOLD_L,borderTop:`1px solid ${GOLD}44`,display:"flex",justifyContent:"flex-end",gap:8}}>
      <Btn sm ghost onClick={cancelEdit}>Cancel</Btn>
      <Btn sm onClick={saveEdit}>Save prices</Btn>
    </div>}
  </div>;
}


function PrintCastTable({items,onSavePrices,onQtyChange}){
  const printItem=items.find(x=>x.name==="3D print fee")||{baseCost:60};
  const castItem=items.find(x=>x.name==="Casting fee")||{baseCost:15};
  const[editing,setEditing]=useState(false);
  const[printFee,setPrintFee]=useState(String(printItem.baseCost));
  const[castFee,setCastFee]=useState(String(castItem.baseCost));
  const[qty,setQty]=useState("1");
  const[override,setOverride]=useState("");
  const print=Number(printFee)||0;
  const cast=Number(castFee)||0;
  const pieces=Math.max(0,Number(qty)||0);
  const ov=Number(override)||0;
  const usingOverride=ov>0;

  const pushSelection=(nextQty,nextOverride)=>{
    const p=Math.max(0,Number(nextQty)||0);
    const o=Number(nextOverride)||0;
    const t=o>0?o:(print+cast)*p;
    const label=o>0?"3D Print & Cast (manual price)":`3D Print & Cast × ${p} piece${p!==1?"s":""}`;
    if(onQtyChange)onQtyChange("pc_combined","1",{id:"pc_combined",name:label,baseCost:t,unit:"job"});
  };
  const handleQtyChange=v=>{setQty(v);pushSelection(v,override);};
  const handleOverrideChange=v=>{setOverride(v);pushSelection(qty,v);};
  const startEdit=()=>{setPrintFee(String(printItem.baseCost));setCastFee(String(castItem.baseCost));setEditing(true);};
  const cancelEdit=()=>setEditing(false);
  const saveEdit=()=>{
    const updated=items.map(item=>{
      if(item.name==="3D print fee")return{...item,baseCost:print};
      if(item.name==="Casting fee")return{...item,baseCost:cast};
      return item;
    });
    onSavePrices(updated);
    setEditing(false);
  };

  const printTotal=print*pieces;
  const castTotal=cast*pieces;
  const total=usingOverride?ov:printTotal+castTotal;

  return <div style={{background:WHITE,borderRadius:5,border:`1px solid ${editing?GOLD:BD}`,overflow:"hidden",transition:"border-color 0.15s"}}>
    {/* Toolbar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",background:editing?GOLD_L:PARCH,borderBottom:`1px solid ${editing?GOLD+"55":BD}`,transition:"background 0.15s"}}>
      <div style={{fontSize:11,fontWeight:700,color:editing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>
        {editing?"Editing rates — update then save":onQtyChange?"3D Print & Cast · fee calculator":"3D Print & Cast · per-piece fees"}
      </div>
      <div style={{display:"flex",gap:8}}>
        {editing
          ?<><Btn sm ghost onClick={cancelEdit}>Cancel</Btn><Btn sm onClick={saveEdit}>Save rates</Btn></>
          :<Btn sm ghost onClick={startEdit}>✎ Edit rates</Btn>}
      </div>
    </div>

    {/* Rate editor */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,padding:"16px 18px",borderBottom:onQtyChange?`1px solid ${BD}`:"none",background:editing?GOLD_L+"66":WHITE}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{`Print fee per piece (${CUR_SYM})`}</div>
        {editing
          ?<input type="number" value={printFee} min="0" step="0.01" onChange={e=>setPrintFee(e.target.value)}
              style={{...SS.inp,marginTop:0,fontSize:16,fontWeight:700,padding:"8px 12px",color:GOLD_D,border:`1px solid ${GOLD}`}}/>
          :<div style={{fontSize:20,fontWeight:800,color:INK}}>{fmt(print)}<span style={{fontSize:12,fontWeight:400,color:WG}}>/piece</span></div>}
      </div>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{`Casting fee per piece (${CUR_SYM})`}</div>
        {editing
          ?<input type="number" value={castFee} min="0" step="0.01" onChange={e=>setCastFee(e.target.value)}
              style={{...SS.inp,marginTop:0,fontSize:16,fontWeight:700,padding:"8px 12px",color:GOLD_D,border:`1px solid ${GOLD}`}}/>
          :<div style={{fontSize:20,fontWeight:800,color:INK}}>{fmt(cast)}<span style={{fontSize:12,fontWeight:400,color:WG}}>/piece</span></div>}
      </div>
    </div>

    {/* Quantity input — quote-builder selector only */}
    {onQtyChange&&<div style={{padding:"16px 18px",borderBottom:`1px solid ${BD}`,background:PARCH+"88",display:"flex",alignItems:"center",gap:16}}>
      <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>Number of pieces</div>
      <input
        type="number"
        value={qty}
        min="0"
        step="1"
        onChange={e=>handleQtyChange(e.target.value)}
        disabled={usingOverride}
        style={{...SS.inp,marginTop:0,width:100,fontSize:18,fontWeight:800,padding:"8px 12px",textAlign:"center",border:`1px solid ${pieces>0&&!usingOverride?GOLD:BD}`,color:INK,opacity:usingOverride?0.5:1}}
      />
    </div>}

    {/* Manual override price — only in the quote-builder selector (onQtyChange present), not on
       the Pricing Database page where there's no quote to feed. */}
    {onQtyChange&&<div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:usingOverride?GOLD_L+"66":WHITE,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200}}>
        <div style={{fontSize:11,fontWeight:700,color:usingOverride?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Manual override price</div>
        <div style={{fontSize:11,color:WG,marginTop:2}}>Enter your own total to ignore the per-piece figures above. Leave blank to use the calculator.</div>
      </div>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
        <input type="number" value={override} min="0" step="0.01" placeholder="0.00"
          onChange={e=>handleOverrideChange(e.target.value)}
          style={{...SS.inp,marginTop:0,width:150,fontSize:16,fontWeight:800,padding:"8px 12px 8px 24px",textAlign:"right",border:`1px solid ${usingOverride?GOLD:BD}`,color:INK}}/>
      </div>
    </div>}

    {/* Result breakdown — quote-builder selector only */}
    {onQtyChange&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"0"}}>
      {[
        ["Pieces",usingOverride?"—":(pieces===0?"—":String(pieces)),WG,false],
        ["Print cost",usingOverride?"—":(pieces===0?"—":fmt(printTotal)),INK,false],
        ["Casting cost",usingOverride?"—":(pieces===0?"—":fmt(castTotal)),INK,false],
        [usingOverride?"Override total":"Total",total>0?fmt(total):"—",OK,true],
      ].map(([label,value,col,accent],i)=>(
        <div key={label} style={{padding:"18px 18px",borderRight:i<3?`1px solid ${BD}`:"none",background:accent&&total>0?OK+"0d":WHITE}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>{label}</div>
          <div style={{fontSize:accent?22:18,fontWeight:800,color:total===0&&!accent?WG:(accent?(total>0?col:WG):col)}}>{value}</div>
        </div>
      ))}
    </div>}
  </div>;
}

function PricingDB({pricing,setPricing,spotPrices,setSpotPrices,markupTable,centreRates=DEFAULT_SETTING_RATES,setCentreRates,onUpdateSpot}){
  const isMobile=useIsMobile();
  const[modal,setModal]=useState(null);
  const[cf,setCf]=useState("All");
  const[editingCostId,setEditingCostId]=useState(null);
  const[editingCostVal,setEditingCostVal]=useState("");
  const[dragId,setDragId]=useState(null);
  const[dragOverId,setDragOverId]=useState(null);
  const[savedToast,setSavedToast]=useState(false);
  const[regularEditing,setRegularEditing]=useState(false);
  const[regularEditPrices,setRegularEditPrices]=useState({});

  const showSaved=()=>{setSavedToast(true);setTimeout(()=>setSavedToast(false),2200);};

  const updateItemCost=(id,val)=>{
    const cost=Number(val);
    if(!val||isNaN(cost)||cost<0)return;
    setPricing(p=>{const n=p.map(x=>x.id===id?{...x,baseCost:cost}:x);persist(K.pr,n);return n;});
    setEditingCostId(null);
    showSaved();
  };

  const isDiamondView=DIAMOND_CATS.includes(cf);
  const isPrintCastView=false;   // 3D Print & Cast now renders as a normal category list (size tiers), replacing the old flat two-fee card
  const isSettingUnifiedView=cf===SETTING_CAT;
  const isAllView=cf==="All";
  const specialCats=[...DIAMOND_CATS,"Basic Setting","Complex Setting"];
  const regularItems=pricing.filter(p=>!specialCats.includes(p.category));
  const filteredRegular=isAllView?regularItems:(!isDiamondView&&!isPrintCastView&&!isSettingUnifiedView?regularItems.filter(p=>p.category===cf):[]);
  const filteredBase=isSettingUnifiedView?pricing.filter(p=>p.category==="Basic Setting").slice().sort((a,b)=>a.sizeMm-b.sizeMm):[];
  // Unified setting rates use a local DRAFT: edit freely, persist to K.csr only on Save (no
  // per-keystroke writes / toast flashing). Re-sync from the prop when there are no unsaved edits.
  const[draft,setDraft]=useState(centreRates);
  const[dirty,setDirty]=useState(false);
  useEffect(()=>{if(!dirty)setDraft(centreRates);},[centreRates]);   // eslint-disable-line react-hooks/exhaustive-deps
  const patchDraft=patch=>{setDraft(d=>({...d,...patch}));setDirty(true);};
  const updateStyle=(key,id,patch)=>patchDraft({[key]:(draft[key]||[]).map(s=>s.id===id?{...s,...patch}:s)});
  const addStyle=key=>patchDraft({[key]:[...(draft[key]||[]),{id:uid(),name:"New style",mult:1}]});
  const removeStyle=(key,id)=>patchDraft({[key]:(draft[key]||[]).filter(s=>s.id!==id)});
  // One editable style table (accent or centre). Called inline (not <Comp/>) so its inputs keep focus.
  const styleTable=(styleKey,title,sub,help)=><div>
    <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:8,display:"flex",alignItems:"center",flexWrap:"wrap"}}>{title} <span style={{fontWeight:400,color:WG,marginLeft:4}}>{sub}</span><InfoDot text={help}/></div>
    <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,overflow:"hidden",marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 110px 44px",gap:8,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
        {["Setting style","Multiplier",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
      </div>
      {(draft[styleKey]||[]).map((s,i,arr)=>(
        <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 110px 44px",columnGap:8,alignItems:"center",padding:"8px 16px",borderBottom:i<arr.length-1?`1px solid ${BD}`:"none"}}>
          <input value={s.name} onChange={e=>updateStyle(styleKey,s.id,{name:e.target.value})} style={{...SS.inp,marginTop:0,fontSize:13,padding:"6px 9px"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,color:WG}}>×</span><input type="number" min="0" step="0.05" value={String(s.mult)} onChange={e=>updateStyle(styleKey,s.id,{mult:Number(e.target.value)||0})} style={{...SS.inp,marginTop:0,fontSize:13,padding:"6px 8px",width:80,fontWeight:700,color:GOLD_D}}/></div>
          <button onClick={()=>removeStyle(styleKey,s.id)} title="Remove style" style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,justifySelf:"center"}}>×</button>
        </div>
      ))}
      <div style={{padding:"10px 16px"}}><button onClick={()=>addStyle(styleKey)} style={{background:"none",border:`1px dashed ${GOLD}`,borderRadius:4,padding:"6px 14px",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add style</button></div>
    </div>
  </div>;
  // Carat bands (#3) — marginal $/ct tiers for centre/large stones.
  const setBands=bands=>patchDraft({caratBands:bands});
  const addBand=()=>setBands([...(draft.caratBands||[]),{upTo:null,perCt:Number(draft.baseCaratRate)||50}]);
  const updateBand=(i,patch)=>setBands((draft.caratBands||[]).map((b,j)=>j===i?{...b,...patch}:b));
  const removeBand=i=>setBands((draft.caratBands||[]).filter((_,j)=>j!==i));
  // Live worked example for the carat-band help text — built from the draft so it previews as you type.
  const cBands=(draft.caratBands||[]).length?draft.caratBands:[{upTo:null,perCt:Number(draft.baseCaratRate)||0}];
  const cFinite=cBands.map(b=>b.upTo==null?null:Number(b.upTo)).filter(v=>v!=null&&v>0);
  const cExampleCt=cFinite.length?Math.max(...cFinite)+0.5:2;
  const cSegs=settingCaratSegments(cExampleCt,draft);
  const cTotal=cSegs.reduce((a,s)=>a+s.cost,0);
  const cSegStr=cSegs.map(s=>`${fmt(s.cost)} (${s.span}ct × ${fmt(s.perCt)}/ct)`).join(" + ");
  // Volume tiers (#5) — per-stone % off once the count reaches a threshold.
  const setTiers=tiers=>patchDraft({volumeTiers:tiers});
  const addTier=()=>setTiers([...(draft.volumeTiers||[]),{minQty:10,offPct:10}]);
  const updateTier=(i,patch)=>setTiers((draft.volumeTiers||[]).map((t,j)=>j===i?{...t,...patch}:t));
  const removeTier=i=>setTiers((draft.volumeTiers||[]).filter((_,j)=>j!==i));
  const saveSettingRates=()=>{setCentreRates(draft);persist(K.csr,draft);setDirty(false);showSaved();};
  const discardSettingRates=()=>{setDraft(centreRates);setDirty(false);};
  const filteredDiamond=isDiamondView?pricing.filter(p=>p.category===cf):[];
  const filteredPrintCast=pricing.filter(p=>p.category==="3D Print & Cast");

  const saveItem=(f,id)=>{setPricing(p=>{const n=id?p.map(x=>x.id===id?{...x,...f}:x):[...p,{...f,id:uid()}];persist(K.pr,n);return n;});setModal(null);};
  const del=id=>{if(!confirm("Delete?"))return;
    // Built-in items would be re-added by the missing-seed merge on next load — remember the
    // deletion so it sticks (and survives the realtime echo of this save).
    if(SEED_PRICING_IDS.has(id)){_deletedSeedIds.add(id);persist(K.delpr,[..._deletedSeedIds]);}
    setPricing(p=>{const n=p.filter(x=>x.id!==id);persist(K.pr,n);return n;});};
  // Drag-reorder regular items: reorder within the currently-shown filtered set, keeping
  // every other item in its original slot in the flat pricing array.
  const reorderRegular=(draggedId,targetId)=>{
    if(!draggedId||!targetId||draggedId===targetId)return;
    const list=filteredRegular.slice();
    const from=list.findIndex(x=>x.id===draggedId);
    const to=list.findIndex(x=>x.id===targetId);
    if(from<0||to<0)return;
    const[moved]=list.splice(from,1);
    list.splice(to,0,moved);
    const ids=new Set(filteredRegular.map(x=>x.id));
    let k=0;
    const next=pricing.map(x=>ids.has(x.id)?list[k++]:x);
    setPricing(next);persist(K.pr,next);showSaved();
  };
  const saveSettingPrices=updatedItems=>{
    const ids=new Set(updatedItems.map(x=>x.id));
    const merged=pricing.map(x=>ids.has(x.id)?updatedItems.find(u=>u.id===x.id):x);
    setPricing(merged);
    persist(K.pr,merged);
    showSaved();
  };


  const DCOLORS={"Lab Grown Diamonds | D-E":"#96627C","Natural diamonds G-H SI1":"#4E8B6A","Natural diamonds D-E VS":"#2D7A4F"};
  return <div>
    <SectionHeader eyebrow="Cost prices" title="Pricing database" subtitle="Your metals, stones, setting and labour rates — the numbers behind every quote." action={<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <Btn ghost onClick={onUpdateSpot}>⟳ Update metal spot prices</Btn>
      <Btn onClick={()=>setModal("add")}>+ Add item</Btn>
    </div>}/>
    {spotPrices?.updatedAt&&<div style={{fontSize:12,color:WG,marginTop:-14,marginBottom:16}}>Metal spot prices last updated <strong style={{color:INK}}>{fmtDate(spotPrices.updatedAt)}</strong>{(Number(spotPrices.premGold)||Number(spotPrices.premGoldWhite)||Number(spotPrices.premPlatinum)||Number(spotPrices.premSilver))?" · casting premiums applied":""}</div>}
    {savedToast&&<div style={{position:"fixed",top:18,right:24,background:OK,color:WHITE,fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:4,boxShadow:"0 4px 18px rgba(0,0,0,0.18)",zIndex:9999,display:"flex",alignItems:"center",gap:8}}>
      ✓ Prices saved — all future quotes will use updated figures
    </div>}

    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
      {NAV_CATS.map(cat=>(
        <button key={cat} onClick={()=>setCf(cat)} style={{padding:"4px 11px",borderRadius:3,border:`1px solid ${cf===cat?(DCOLORS[cat]||GOLD):BD}`,background:cf===cat?(DCOLORS[cat]||GOLD):"transparent",color:cf===cat?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{catTitle(cat)}</button>
      ))}
    </div>

    {/* Global cost-price note — applies to every Pricing DB view */}
    <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"11px 16px",marginBottom:14,fontSize:13,color:WG,lineHeight:1.6}}>
      <strong style={{color:INK}}>These are your cost prices, the mark-up is applied automatically by the multiplier table.</strong> The one exception is the repair prices that are already shown as a retail guide.
    </div>

    {/* Unified Stone Setting view — base rates + style multipliers + careful-stone uplift */}
    {isSettingUnifiedView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"16px 18px",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:800,color:INK,marginBottom:4}}>How your setting prices work</div>
        <div style={{fontSize:12.5,color:WG,lineHeight:1.6,marginBottom:12}}>What it costs you to have stones set (the setting labour). Every price starts from a base rate, then adjusts for the factors below. You set them all here as <strong style={{color:INK}}>cost prices</strong>; your markup table is added on top to reach the client's retail price.</div>
        {[
          ["Base rate","A plain claw / prong setting. Small stones are priced per stone by size (mm); a centre or feature stone by its carat weight. Everything else builds on this."],
          ["Setting style","Fancier styles (bezel, pavé, channel…) take more bench time, so each one multiplies the base rate (claw = ×1)."],
          ["Extra care","A percentage added only for precious or fragile stones, when you tick Precious / High Value on a quote."],
          ["Platinum","An optional surcharge, for when your setter charges more to set into platinum."],
          ["Volume","An automatic per-stone discount when you're setting lots of small stones (pavé / melee runs)."],
        ].map(([term,desc])=>(
          <div key={term} style={{display:"flex",gap:14,padding:"9px 0",borderTop:`1px solid ${BD}`}}>
            <div style={{flex:"0 0 92px",fontWeight:700,color:INK,fontSize:12.5}}>{term}</div>
            <div style={{flex:1,minWidth:0,fontSize:12.5,color:WG,lineHeight:1.55}}>{desc}</div>
          </div>
        ))}
      </div>
      {/* Uplifts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px",marginBottom:16}}>
        <Input label={<>Precious / High Value (Extra Care Needed) uplift (%)<InfoDot text="An extra percentage added when a stone needs careful setting because it's precious or fragile (emeralds, opals, tanzanite, or a high-value centre diamond). It only applies when you tick Precious / High Value on a setting line. Leave it at 0 if you don't charge more for delicate stones."/></>} type="number" min="0" value={String(draft.carefulUpliftPct??0)} onChange={v=>patchDraft({carefulUpliftPct:Number(v)||0})}/>
        <Input label={<>Platinum uplift (%)<InfoDot text="Some setters charge more to set stones into platinum, as it's harder and slower to work than gold. Enter that surcharge as a %. It only applies when you tick Platinum on a setting line. Leave it at 0 if your setter doesn't charge extra for platinum."/></>} type="number" min="0" value={String(draft.platinumUpliftPct??0)} onChange={v=>patchDraft({platinumUpliftPct:Number(v)||0})}/>
        <div/>
      </div>
      {/* #3 Carat rate bands (centre / large stones) */}
      <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:8,display:"flex",alignItems:"center",flexWrap:"wrap"}}>Setting fee by carat weight <span style={{fontWeight:400,color:WG,marginLeft:4}}>(centre / feature stones)</span><InfoDot text={`What it costs to set a centre or feature stone, based on its carat weight. Bigger stones take more time but not proportionally (a 2ct isn't double the work of a 1ct), so the price per carat drops as the stone gets heavier. Each row below is a weight range with its own ${CUR_SYM}/ct rate, and a stone is charged across whichever rows its weight spans. Example: a ${cExampleCt}ct stone = ${cSegStr} = ${fmt(cTotal)}. Leave the last row's 'up to' blank so it covers everything heavier. Prefer one flat rate? Set every row to the same ${CUR_SYM}/ct. These are trade / wholesale cost prices; your markup table is applied on top to reach the retail price the client sees.`}/></div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,overflow:"hidden",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 44px",gap:8,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["Up to (ct)","$ per carat",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {(draft.caratBands||[]).map((b,i,arr)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 44px",columnGap:8,alignItems:"center",padding:"8px 16px",borderBottom:i<arr.length-1?`1px solid ${BD}`:"none"}}>
            <input type="number" min="0" step="0.1" placeholder={b.upTo==null?"and above":"e.g. 1"} value={b.upTo==null?"":String(b.upTo)} onChange={e=>updateBand(i,{upTo:e.target.value===""?null:Number(e.target.value)})} style={{...SS.inp,marginTop:0,fontSize:13,padding:"6px 9px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,color:WG}}>$</span><input type="number" min="0" step="1" value={String(b.perCt??0)} onChange={e=>updateBand(i,{perCt:Number(e.target.value)||0})} style={{...SS.inp,marginTop:0,fontSize:13,padding:"6px 8px",fontWeight:700,color:GOLD_D}}/></div>
            <button onClick={()=>removeBand(i)} title="Remove band" style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,justifySelf:"center"}}>×</button>
          </div>
        ))}
        <div style={{padding:"10px 16px"}}><button onClick={addBand} style={{background:"none",border:`1px dashed ${GOLD}`,borderRadius:4,padding:"6px 14px",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add band</button></div>
      </div>
      {/* Style multipliers — split into accent/melee vs centre/feature */}
      {styleTable("accentStyles","Accent / melee setting styles","(smaller stones, priced per stone by mm)","Claw / prong is the base at ×1; a style at ×1.5 costs 1½× the base to set. These are the styles you use on small accent or melee work. Add, rename, re-multiply or remove, then hit Save changes at the bottom.")}
      {styleTable("centreStyles","Centre / feature setting styles","(centre or feature stones, priced by carat)","The styles you use on a centre or feature stone (bezel, V-claw, pear, etc.). Claw / prong is the base at ×1. Add, rename, re-multiply or remove, then hit Save changes at the bottom.")}
      {/* Base per-stone rate table (mm) */}
      <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>Base per-stone rates <span style={{fontWeight:400,color:WG}}>(Prong/Claw is generally the baseline for most setters, every setting style multiplies from this)</span></div>
      <SettingTable items={filteredBase} onSavePrices={saveSettingPrices} label="Setting base rates"/>
      {/* #5 Volume rates */}
      <div style={{fontSize:12,fontWeight:700,color:INK,marginTop:18,marginBottom:6}}>Volume rates <span style={{fontWeight:400,color:WG}}>(Setting many small stones usually costs less per stone. The highest tier the quantity reaches applies to the whole line. Leave empty if you or your setter charges per stone with no discount for high-volume setting.)</span></div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 44px",gap:8,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["From (stones)","% off per stone",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {(draft.volumeTiers||[]).length===0&&<div style={{padding:"12px 16px",fontSize:12,color:WG}}>No volume tiers — every stone is charged the full rate.</div>}
        {(draft.volumeTiers||[]).map((t,i,arr)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 44px",columnGap:8,alignItems:"center",padding:"8px 16px",borderBottom:i<arr.length-1?`1px solid ${BD}`:"none"}}>
            <input type="number" min="1" step="1" value={String(t.minQty??1)} onChange={e=>updateTier(i,{minQty:Number(e.target.value)||1})} style={{...SS.inp,marginTop:0,fontSize:13,padding:"6px 9px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" min="0" max="100" step="1" value={String(t.offPct??0)} onChange={e=>updateTier(i,{offPct:Number(e.target.value)||0})} style={{...SS.inp,marginTop:0,fontSize:13,padding:"6px 8px",fontWeight:700,color:GOLD_D}}/><span style={{fontSize:12,color:WG}}>%</span></div>
            <button onClick={()=>removeTier(i)} title="Remove tier" style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,justifySelf:"center"}}>×</button>
          </div>
        ))}
        <div style={{padding:"10px 16px"}}><button onClick={addTier} style={{background:"none",border:`1px dashed ${GOLD}`,borderRadius:4,padding:"6px 14px",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add tier</button></div>
      </div>
      {/* Save bar — plain inline row at the end of the section */}
      <div style={{marginTop:20,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,flexWrap:"wrap"}}>
        {dirty&&<div style={{fontSize:12,color:GOLD_D,fontWeight:700,marginRight:"auto"}}>Unsaved changes</div>}
        {dirty&&<Btn sm ghost onClick={discardSettingRates}>Discard</Btn>}
        <Btn sm onClick={saveSettingRates} disabled={!dirty}>Save changes</Btn>
      </div>
    </div>}

    {/* Diamond view */}
    {isDiamondView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"12px 16px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        <strong style={{color:DCOLORS[cf]||INK}}>{catTitle(cf)}</strong>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>{DIAMOND_CAT_LABELS[cf]}</span>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>Raw costs per stone — markup applied at quote time via multiplier table. Add a Basic Setting line separately for the setting labour cost.</span>
      </div>
      <DiamondTable items={filteredDiamond} onSavePrices={saveSettingPrices}/>
    </div>}

    {/* 3D Print & Cast view */}
    {isPrintCastView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"12px 16px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        <strong style={{color:INK}}>3D Printing & Casting — per-piece fees</strong>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>Set your print and cast fees per piece — edit any time. At quote time these are multiplied by the number of pieces and added as separate lines.</span>
      </div>
      <PrintCastTable items={filteredPrintCast} onSavePrices={saveSettingPrices}/>
    </div>}

    {/* Regular items view */}
    {!isDiamondView&&!isPrintCastView&&!isSettingUnifiedView&&<>
      {filteredRegular.length>0&&<div style={{background:WHITE,borderRadius:5,border:`1px solid ${regularEditing?GOLD:BD}`,overflow:"hidden",marginBottom:16,transition:"border-color 0.15s"}}>
        {/* Table header bar with edit button */}
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"space-between",alignItems:isMobile?"flex-start":"center",gap:isMobile?10:0,padding:"10px 16px",background:regularEditing?GOLD_L:PARCH,borderBottom:`1px solid ${regularEditing?GOLD+"55":BD}`}}>
          <div style={{fontSize:11,fontWeight:700,color:regularEditing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>
            {regularEditing?"Editing prices — update then save":(isMobile?"Tap ✎ to edit cost prices":"Drag ⠿ to reorder · click ✎ to update cost prices")}
          </div>
          <div style={{display:"flex",gap:8}}>
            {regularEditing
              ?<><Btn sm ghost onClick={()=>setRegularEditing(false)}>Cancel</Btn><Btn sm onClick={()=>{
                  const n=pricing.map(x=>regularEditPrices[x.id]!==undefined?{...x,baseCost:Number(regularEditPrices[x.id]??x.baseCost)}:x);
                  setPricing(n);persist(K.pr,n);setRegularEditing(false);showSaved();
                }}>Save prices</Btn></>
              :<Btn sm ghost onClick={()=>{
                  const m={};filteredRegular.forEach(x=>{m[x.id]=String(x.baseCost);});
                  setRegularEditPrices(m);setRegularEditing(true);
                }}>✎ Edit prices</Btn>}
          </div>
        </div>
        {/* Column headers — hidden on mobile where rows become stacked cards */}
        {!isMobile&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr 60px 110px 92px",padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["Item","Category","Unit","Your cost",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>}
        {(()=>{
          const isRepairsView=cf===REPAIRS_CAT;
          let lastGroup=null;let lastSubgroup=null;
          return filteredRegular.map((item,i)=>{
            const showGroupHeader=isRepairsView&&item.group&&item.group!==lastGroup;
            if(showGroupHeader){lastGroup=item.group;lastSubgroup=null;}
            const showSubgroupHeader=isRepairsView&&item.subgroup&&(item.subgroup!==lastSubgroup);
            if(showSubgroupHeader)lastSubgroup=item.subgroup;
            const canDrag=!regularEditing;
            const isDragTarget=dragOverId===item.id&&dragId&&dragId!==item.id;
            const row=<div key={item.id}
                draggable={canDrag}
                onDragStart={canDrag?(e=>{setDragId(item.id);e.dataTransfer.effectAllowed="move";}):undefined}
                onDragOver={canDrag?(e=>{e.preventDefault();if(dragOverId!==item.id)setDragOverId(item.id);}):undefined}
                onDragLeave={canDrag?(()=>setDragOverId(o=>o===item.id?null:o)):undefined}
                onDrop={canDrag?(e=>{e.preventDefault();reorderRegular(dragId,item.id);setDragId(null);setDragOverId(null);}):undefined}
                onDragEnd={()=>{setDragId(null);setDragOverId(null);}}
                style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"2fr 1fr 60px 110px 92px",columnGap:10,rowGap:isMobile?8:0,padding:"10px 16px",borderBottom:i<filteredRegular.length-1?`1px solid ${BD}`:"none",borderTop:isDragTarget?`2px solid ${GOLD}`:"2px solid transparent",alignItems:"center",opacity:dragId===item.id?0.4:1,background:isDragTarget?GOLD_L+"66":"transparent",transition:"background 0.1s"}}>
                <div style={{fontWeight:600,fontSize:13,color:INK,display:"flex",alignItems:"center",gap:8,gridColumn:isMobile?"1 / -1":"auto",minWidth:0}}>{canDrag&&<span title="Drag to reorder" style={{cursor:"grab",color:WG,fontSize:14,lineHeight:1,flexShrink:0}}>⠿</span>}{item.name}</div>
                <div><Badge label={item.category} color={WG}/></div>
                <div style={{fontSize:12,color:WG}}>/{item.unit}</div>
                <div>
                  {item.poa
                    ?<span style={{fontSize:11,fontWeight:700,color:"#96627C",background:"rgba(150,98,124,0.12)",border:"1px solid rgba(150,98,124,0.3)",borderRadius:4,padding:"3px 8px",letterSpacing:"0.04em"}}>MANUAL QUOTE</span>
                    :regularEditing
                      ?<input type="number" value={regularEditPrices[item.id]||""} min="0" step="0.01" autoFocus={i===0}
                          onChange={e=>setRegularEditPrices(p=>({...p,[item.id]:e.target.value}))}
                          style={{width:"90px",padding:"5px 8px",borderRadius:7,border:`1px solid ${GOLD}`,fontSize:13,fontFamily:"inherit",color:GOLD_D,fontWeight:700,background:GOLD_L,outline:"none",textAlign:"right"}}/>
                      :<span style={{fontSize:13,fontWeight:700,color:INK}}>{fmt(item.baseCost)}</span>}
                </div>
                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                  {!regularEditing&&<><Btn sm ghost onClick={()=>setModal(item)} title="Edit item — rename, change unit or cost">✎</Btn><Btn sm danger onClick={()=>del(item.id)} title="Delete item">×</Btn></>}
                </div>
              </div>;
            const prefix2=[];
            if(showGroupHeader)prefix2.push(<div key={item.id+"_g"} style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr 60px 110px 92px",padding:"7px 16px",background:PARCH,borderTop:i>0?`1px solid ${BD}`:"none",borderBottom:`1px solid ${BD}`}}><div style={{gridColumn:"1/-1",fontSize:10,fontWeight:800,color:GOLD_D,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.group}</div></div>);
            if(showSubgroupHeader)prefix2.push(<div key={item.id+"_sg"} style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr 60px 110px 92px",padding:"5px 16px",background:"transparent",borderBottom:`1px solid ${BD}`}}><div style={{gridColumn:"1/-1",fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.07em",paddingLeft:2}}>{item.subgroup}</div></div>);
            if(!prefix2.length)return row;
            return [...prefix2,row];
          });
        })()}
      </div>}
      {isAllView&&<div style={{marginTop:4}}>
        <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Setting &amp; diamond price tables</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
          {/* 3D Print & Cast card */}
          {(()=>{
            const its=pricing.filter(p=>p.category==="3D Print & Cast");
            const costs=its.map(x=>Number(x.baseCost)||0).filter(n=>n>0);
            const lo=costs.length?Math.min(...costs):0,hi=costs.length?Math.max(...costs):0;
            return <div onClick={()=>setCf("3D Print & Cast")} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD} onMouseLeave={e=>e.currentTarget.style.borderColor=BD}>
              <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>3D Print &amp; Cast</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>Per-piece print &amp; cast fees<br/><strong style={{color:INK}}>{fmt(lo)} to {fmt(hi)}/piece</strong> · {its.length} rate{its.length!==1?"s":""}<br/><span style={{color:WG}}>Editable · added per piece at quote time</span></div>
              <div style={{fontSize:11,color:GOLD_D,fontWeight:700,marginTop:8}}>View rates →</div>
            </div>;
          })()}
          {/* Basic Setting card */}
          {(()=>{
            const its=pricing.filter(p=>p.category==="Basic Setting").sort((a,b)=>a.sizeMm-b.sizeMm);
            return <div onClick={()=>setCf("Basic Setting")} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD} onMouseLeave={e=>e.currentTarget.style.borderColor=BD}>
              <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>Basic Setting</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>{its.length} sizes · {its[0]?.sizeMm}mm – {its[its.length-1]?.sizeMm}mm<br/>Setting labour: {fmt(its[0]?.baseCost)} – {fmt(its[its.length-1]?.baseCost)}/stone<br/><span style={{color:WG}}>Applies to all stone types</span></div>
              <div style={{fontSize:11,color:GOLD_D,fontWeight:700,marginTop:8}}>View chart →</div>
            </div>;
          })()}
          {/* Complex Setting card */}
          {(()=>{
            const its=pricing.filter(p=>p.category==="Complex Setting").sort((a,b)=>a.sizeMm-b.sizeMm);
            return <div onClick={()=>setCf("Complex Setting")} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:5,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD} onMouseLeave={e=>e.currentTarget.style.borderColor=BD}>
              <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>Complex Setting</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>{its.length} sizes · {its[0]?.sizeMm}mm – {its[its.length-1]?.sizeMm}mm<br/>Setting labour: {fmt(its[0]?.baseCost)} – {fmt(its[its.length-1]?.baseCost)}/stone<br/><span style={{color:WG}}>French Pavé · Channel · Bezel</span></div>
              <div style={{fontSize:11,color:GOLD_D,fontWeight:700,marginTop:8}}>View chart →</div>
            </div>;
          })()}
          {DIAMOND_CATS.map(cat=>{
            const its=pricing.filter(p=>p.category===cat).sort((a,b)=>a.sizeMm-b.sizeMm);
            const col=DCOLORS[cat]||WG;
            return <div key={cat} onClick={()=>setCf(cat)} style={{background:WHITE,border:`1px solid ${col}44`,borderRadius:5,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=col} onMouseLeave={e=>e.currentTarget.style.borderColor=col+"44"}>
              <div style={{fontSize:12,fontWeight:700,color:col,marginBottom:6}}>{catTitle(cat)}</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>{its.length} sizes · {its[0]?.sizeMm}mm – {its[its.length-1]?.sizeMm}mm<br/>{fmt(its[0]?.baseCost)} – {fmt(its[its.length-1]?.baseCost)} per stone</div>
              <div style={{fontSize:11,color:col,fontWeight:700,marginTop:8}}>View chart →</div>
            </div>;
          })}
        </div>
      </div>}
    </>}
    {modal&&<Modal title={modal==="add"?"New pricing item":"Edit item"} onClose={()=>setModal(null)}>
      <PricingItemForm initial={modal==="add"?{}:modal} spotPrices={spotPrices} onSave={f=>saveItem(f,modal==="add"?null:modal.id)} onCancel={()=>setModal(null)}/>
    </Modal>}
  </div>;
}

// Carat / fineness presets → purity as a decimal (share of fine metal), per linked metal.
const PURITY_PRESETS={
  gold:[["0.375","9ct (37.5%)"],["0.417","10ct (41.7%)"],["0.585","14ct (58.5%)"],["0.625","15ct (62.5%)"],["0.75","18ct (75%)"],["0.833","20ct (83.3%)"],["0.916","22ct (91.6%)"],["0.999","24ct (99.9%)"]],
  platinum:[["0.85","Platinum 850"],["0.90","Platinum 900"],["0.95","Platinum 950"],["0.999","Platinum 999"]],
  silver:[["0.925","Sterling 925"],["0.958","Britannia 958"],["0.999","Fine 999"]],
};
function PricingItemForm({initial={},spotPrices={},onSave,onCancel}){
  const[f,setF]=useState({category:PCAT[0],name:"",unit:"stone",baseCost:"",detail:"",group:"",...initial});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const isAccent=f.category==="Accent Stones";
  const isRepair=f.category===REPAIRS_CAT;
  const isMetal=f.category==="Metals";
  // A metal item that's linked to a spot key + purity auto-recalculates on every spot update.
  const linked=isMetal&&f.metalKey&&f.purity!=null&&f.purity!=="";
  const spotFor=k=>Number(spotPrices?.[k])||0;
  // Colour only matters for gold; resolves to white/yellow/rose so the right casting premium applies.
  const goldColour=f.metalKey==="gold"?goldColourOf(f):null;
  const autoCost=linked?+((spotFor(f.metalKey)*(1+premForMetal({...f,colour:goldColour},spotPrices)/100))*Number(f.purity)).toFixed(4):0;
  // Hand-fabricated cost per gram: single global mill premium, no casting-house charge.
  const fabCost=linked?+((spotFor(f.metalKey)*(1+(Number(spotPrices?.premFab)||0)/100))*Number(f.purity)).toFixed(4):0;
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label="Category" value={f.category} onChange={v=>{setF(p=>({...p,category:v,group:""}));}} as="select" options={PCAT.filter(c=>c!=="Accent Stones"||f.category==="Accent Stones").map(c=>({value:c,label:catTitle(c)}))}/>
      {!isAccent&&<Input label="Unit" value={f.unit} onChange={set("unit")} as="select" options={["job","g","stone","ct","item","pair","hr","piece","set"]}/>}
    </div>
    {isRepair&&<Input label="Group" value={f.group||""} onChange={set("group")} as="select" options={["(no group)",...REPAIR_GROUPS]}/>}
    <Input label="Item name / description" value={f.name} onChange={set("name")} placeholder={isAccent?"e.g. 2mm blue sapphires":"e.g. 14ct white gold"}/>
    {isMetal&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Input label="Linked metal" value={f.metalKey||""} onChange={v=>setF(p=>({...p,metalKey:v,purity:v?p.purity:null}))} as="select" options={[{value:"",label:"— Not linked (manual price) —"},{value:"gold",label:"Gold"},{value:"platinum",label:"Platinum"},{value:"silver",label:"Silver"}]}/>
        {f.metalKey&&<Input label="Purity / carat" value={f.purity!=null?String(f.purity):""} onChange={v=>set("purity")(v===""?null:v)} as="select" options={[{value:"",label:"— Select —"},...(PURITY_PRESETS[f.metalKey]||[]).map(([val,lbl])=>({value:val,label:lbl}))]}/>}
        {f.metalKey==="gold"&&<Input label="Gold colour" value={goldColour||"yellow"} onChange={set("colour")} as="select" options={[{value:"yellow",label:"Yellow"},{value:"white",label:"White — palladium premium"},{value:"rose",label:"Rose"}]}/>}
      </div>
      <div style={{background:"#EDF5EF",border:"1px solid #C8DFF0",borderRadius:4,padding:"10px 14px",fontSize:12,color:"#4E8B6A",marginBottom:14,lineHeight:1.5}}>
        {linked
          ?<>Cost updates automatically whenever you update spot prices{autoCost>0?<> — <strong>cast {fmt(autoCost)}/g</strong> · <strong>fabricated {fmt(fabCost)}/g</strong>{goldColour==="white"?" (white-gold casting premium applied)":""}</>:" (set your spot prices to calculate)"}.</>
          :<>Link this to a metal + purity so it recalculates automatically with spot prices. Leave unlinked to keep a fixed manual cost.</>}
      </div>
    </>}
    {isAccent
      ?<>
        <Input label="Notes / detail (optional)" value={f.detail||""} onChange={set("detail")} placeholder="e.g. heat treated, round, supplier XYZ"/>
        <div style={{background:"#EDF5EF",border:"1px solid #C8DFF0",borderRadius:4,padding:"10px 14px",fontSize:12,color:"#4E8B6A",marginBottom:14}}>
          Cost is entered per quote — accent stone prices vary job to job.
        </div>
      </>
      :linked
        ?<div style={{marginBottom:14}}>
          <label style={SS.lbl}>Cost per gram <span style={{textTransform:"none",letterSpacing:0,fontWeight:400,color:WG}}>(auto from spot — cast · fabricated)</span></label>
          <div style={{...SS.inp,marginTop:4,background:PARCH,color:autoCost>0?INK:WG,fontWeight:autoCost>0?700:400}}>{autoCost>0?<>{fmt(autoCost)} <span style={{color:WG,fontWeight:400}}>cast</span> · {fmt(fabCost)} <span style={{color:WG,fontWeight:400}}>fabricated</span> / g</>:"Update spot prices to calculate"}</div>
        </div>
        :<Input label={`Your cost per unit (${CUR_SYM})`} value={f.baseCost} onChange={set("baseCost")} type="number" min="0" step="0.01"/>
    }
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn ghost onClick={onCancel}>Cancel</Btn>
      <Btn onClick={()=>{
        if(!f.name.trim())return alert("Name required");
        if(isMetal&&f.metalKey&&(f.purity==null||f.purity==="")) return alert("Select a purity / carat for the linked metal — or set it to “Not linked”.");
        if(!isAccent&&!linked&&!f.baseCost)return alert("Cost required");
        const saved={...f,noMarkup:isRepair?true:f.noMarkup};
        if(isRepair&&saved.group==="(no group)")saved.group="";
        if(isMetal){
          if(linked){saved.metalKey=f.metalKey;saved.purity=Number(f.purity);saved.baseCost=autoCost;saved.unit="g";saved.colour=f.metalKey==="gold"?goldColour:null;}
          else{saved.metalKey="";saved.purity=null;saved.colour=null;}   // unlinked → clear so the spot updater skips it
        }
        onSave(saved);
      }}>Save item</Btn>
    </div>
  </div>;
}

function SpotPriceUpdater({spotPrices,setSpotPrices,pricing,setPricing,onClose}){
  const[g,setG]=useState(String(spotPrices.gold));
  const[pt,setPt]=useState(String(spotPrices.platinum));
  const[ag,setAg]=useState(String(spotPrices.silver));
  // Casting-house premium (%) per metal — what your supplier charges ABOVE spot. Saved with the
  // spot prices, so live fetches keep producing your real landed cost, not the market price.
  const[pmG,setPmG]=useState(String(spotPrices.premGold??0));
  // White gold's higher casting premium (palladium alloy). Defaults to the base gold premium so
  // upgrading users see no change until they bump it up.
  const[pmGW,setPmGW]=useState(String(spotPrices.premGoldWhite??spotPrices.premGold??0));
  const[pmPt,setPmPt]=useState(String(spotPrices.premPlatinum??0));
  const[pmAg,setPmAg]=useState(String(spotPrices.premSilver??0));
  // Hand-fabricated metal: bought as mill product (sheet/wire), no casting-house premium.
  // One premium over spot for all metals (usually lower than casting). Bench labour is billed separately.
  const[pmFab,setPmFab]=useState(String(spotPrices.premFab??0));
  // Premiums are set once and rarely touched, so the panel starts collapsed for returning studios
  // and open for a fresh setup (nothing configured yet) so first-run users don't miss it.
  const[showPrem,setShowPrem]=useState(!(Number(spotPrices.premGold)||Number(spotPrices.premPlatinum)||Number(spotPrices.premSilver)||Number(spotPrices.premFab)));
  const loaded=(spot,prem)=>Number(spot)*(1+(Number(prem)||0)/100);   // spot → your cost/g of fine metal
  const[fetching,setFetching]=useState(false);
  const[fetched,setFetched]=useState(null);   // {marketTimestamp} once live prices have filled the fields
  // Pull live AUD/gram spot from the metal-prices edge function (metals.dev behind it).
  // Fills the fields only — you still review the numbers and press Apply.
  const fetchLive=async()=>{
    setFetching(true);
    try{
      const{data,error}=await supabase.functions.invoke("metal-prices",{body:{currency:CUR_CODE||"AUD"}});
      if(error||!data||data.error||!(Number(data.gold)>0))throw new Error(data?.error||error?.message||"No prices returned");
      setG(String(data.gold));
      if(Number(data.platinum)>0)setPt(String(data.platinum));
      setAg(String(data.silver));
      setFetched({marketTimestamp:data.marketTimestamp});
    }catch(e){
      alert("Couldn't fetch live prices — "+(e.message||e)+"\n\nYou can still enter the spot prices manually.");
    }
    setFetching(false);
  };
  const apply=()=>{
    const ns={gold:Number(g),platinum:Number(pt),silver:Number(ag),
      premGold:Number(pmG)||0,premGoldWhite:Number(pmGW)||0,premPlatinum:Number(pmPt)||0,premSilver:Number(pmAg)||0,premFab:Number(pmFab)||0,updatedAt:today()};
    setSpotPrices(ns);persist(K.spot,ns);
    // Pricing DB metal costs = (spot × (1 + premium%)) × purity — your cost, not the market's.
    // baseCost = CAST cost (casting-house premium, white-aware via premForMetal).
    // baseCostFab = HAND-FABRICATED cost (single mill premium, no casting-house charge).
    const spotOf=k=>k==="gold"?ns.gold:k==="platinum"?ns.platinum:k==="silver"?ns.silver:0;
    setPricing(prev=>{const u=prev.map(item=>{if(item.category!=="Metals"||!item.metalKey||item.purity==null)return item;const spot=spotOf(item.metalKey);if(!spot)return item;const cast=loaded(spot,premForMetal(item,ns))*item.purity;const fab=loaded(spot,ns.premFab)*item.purity;return{...item,baseCost:Number(cast.toFixed(4)),baseCostFab:Number(fab.toFixed(4))};});persist(K.pr,u);return u;});
    onClose();
  };
  // Little colour swatch that makes each metal scannable in the label row.
  const dot=c=><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:c,marginRight:7,verticalAlign:"middle",boxShadow:"0 0 0 1px rgba(0,0,0,0.06)"}}/>;
  return <Modal title="Update metal spot prices" onClose={onClose} maxW={680}
    footer={<div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn ghost onClick={onClose}>Cancel</Btn><Btn onClick={apply}>Apply prices</Btn></div>}>
    <div style={{fontSize:13.5,color:WG,lineHeight:1.6,marginBottom:18}}>{`Enter today's fine metal spot price per gram (${CUR_CODE}), or fetch it live. Every metal item in your pricing list updates automatically from its purity.`}</div>

    {/* Hero — the daily task: today's spot, entered by hand or fetched live */}
    <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:14,padding:"18px 20px",marginBottom:16,boxShadow:SHADOW}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.06em"}}>Today's fine metal spot price</div>
        {supabaseEnabled&&<Btn sm onClick={fetchLive} disabled={fetching}>{fetching?"Fetching…":"⟳ Fetch live prices"}</Btn>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
        <Input label={<>{dot("linear-gradient(135deg,#F3D27A,#D6A63A)")}Fine gold ({CUR_SYM}/g)</>} value={g} onChange={setG} type="number" min="0" step="0.01"/>
        <Input label={<>{dot("#D4D8DF")}Platinum ({CUR_SYM}/g)</>} value={pt} onChange={setPt} type="number" min="0" step="0.01"/>
        <Input label={<>{dot("#BEC3CB")}Silver ({CUR_SYM}/g)</>} value={ag} onChange={setAg} type="number" min="0" step="0.01"/>
      </div>
      {supabaseEnabled&&<div style={{minHeight:16,marginTop:-4}}>
        {fetched?<span style={{fontSize:12,color:OK,fontWeight:600}}>✓ Live spot loaded{fetched.marketTimestamp?` · market time ${new Date(fetched.marketTimestamp).toLocaleString(LOCALE,{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}`:""}. Review and apply below.</span>
         :!fetching&&<span style={{fontSize:12,color:WG}}>{`Live ${CUR_CODE} spot per gram via metals.dev`}</span>}
      </div>}
    </div>

    {/* Supplier premiums — set once, applied to every price update; collapsed for returning studios */}
    <div style={{border:`1px solid ${BD}`,borderRadius:14,marginBottom:16,overflow:"hidden"}}>
      <button onClick={()=>setShowPrem(s=>!s)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 18px",background:PARCH,border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.06em"}}>Supplier premiums</div>
          <div style={{fontSize:12,color:WG,marginTop:3,lineHeight:1.5}}>What you pay above spot to cast or hand-fabricate</div>
        </div>
        <span style={{fontSize:12,color:WG,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>{showPrem?"Hide ▲":"Edit ▾"}</span>
      </button>
      {showPrem&&<div style={{padding:"18px",borderTop:`1px solid ${BD}`,background:WHITE}}>
        {/* Casting-house premium — the % your supplier charges above spot for cast metal */}
        <div style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2,display:"flex",alignItems:"center"}}>Casting house premium <span style={{color:WG,fontWeight:700,marginLeft:5}}>· cast metal</span><InfoDot text="Your landed cost per gram = spot price × (1 + this %) × purity. It's what your caster charges above market to cast the metal. Set it once, and every manual or live price update applies it automatically."/></div>
        <div style={{fontSize:12,color:WG,marginBottom:12,lineHeight:1.5}}>What your casting house charges <strong style={{color:INK}}>above spot</strong> to cast a piece in each metal. This is your <strong style={{color:INK}}>cast</strong> cost. Saved once, every price update (manual or live) applies it automatically.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Input label="Gold, yellow / rose (%)" value={pmG} onChange={setPmG} type="number" min="0" step="0.5" placeholder="0"/>
          <Input label="Gold, white (%)" value={pmGW} onChange={setPmGW} type="number" min="0" step="0.5" placeholder="0"/>
          <Input label="Platinum premium (%)" value={pmPt} onChange={setPmPt} type="number" min="0" step="0.5" placeholder="0"/>
          <Input label="Silver premium (%)" value={pmAg} onChange={setPmAg} type="number" min="0" step="0.5" placeholder="0"/>
        </div>
        <div style={{fontSize:11,color:WG,marginTop:4,marginBottom:18,lineHeight:1.5}}>White gold usually costs more to cast because of the palladium in the master alloy. Set a higher % here; it applies only to metal items marked <strong style={{color:INK}}>white</strong>.</div>
        {/* Fabrication premium — mill metal (sheet/wire) for hand-fabricated work; usually lower, no casting-house charge */}
        <div style={{borderTop:`1px solid ${BD_SOFT}`,paddingTop:16}}>
          <div style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Fabrication premium <span style={{color:WG,fontWeight:700}}>· hand-fabricated metal</span></div>
          <div style={{fontSize:12,color:WG,marginBottom:12,lineHeight:1.5}}>What you pay over spot for <strong style={{color:INK}}>mill metal</strong> (sheet, wire, grain) built at the bench, usually lower than casting. Bench labour is billed separately, so each metal has a <strong style={{color:INK}}>cast</strong> and a <strong style={{color:INK}}>fabricated</strong> cost you choose between per quote line.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Input label="Fabrication / mill premium (%)" value={pmFab} onChange={setPmFab} type="number" min="0" step="0.5" placeholder="0"/>
          </div>
        </div>
      </div>}
    </div>

    <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:14,padding:"16px 18px",marginBottom:4}}>
      <div style={{fontSize:11,fontWeight:800,color:INK,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Preview: your cost per gram</div>
      {(()=>{const col="minmax(0,1fr) 92px 92px";return <>
        <div style={{display:"grid",gridTemplateColumns:col,gap:"0 26px",paddingBottom:7,borderBottom:`1px solid ${BD}`}}>
          <span style={{fontSize:10,fontWeight:800,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Metal type</span>
          <span style={{textAlign:"right",fontSize:10,fontWeight:800,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Cast</span>
          <span style={{textAlign:"right",fontSize:10,fontWeight:800,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Fabricated</span>
        </div>
        {[{n:"9ct yellow / rose gold",k:"gold",p:0.375,prem:pmG},{n:"18ct yellow / rose gold",k:"gold",p:0.75,prem:pmG},{n:"18ct white gold",k:"gold",p:0.75,prem:pmGW},{n:"Platinum 950",k:"platinum",p:0.95,prem:pmPt},{n:"Silver 925",k:"silver",p:0.925,prem:pmAg}].map((m,i)=>{
          const spot=m.k==="gold"?Number(g):m.k==="platinum"?Number(pt):Number(ag);
          const cast=loaded(spot,m.prem)*m.p;
          const fab=loaded(spot,pmFab)*m.p;
          return <div key={m.n} style={{display:"grid",gridTemplateColumns:col,gap:"0 26px",alignItems:"center",padding:"7px 0",borderTop:i?`1px solid ${BD_SOFT}`:"none"}}>
            <span style={{color:INK,fontSize:13}}>{m.n}</span>
            <span style={{textAlign:"right",fontWeight:700,color:INK,fontSize:13,fontVariantNumeric:"tabular-nums"}}>{fmt(cast)}</span>
            <span style={{textAlign:"right",fontWeight:700,color:INK,fontSize:13,fontVariantNumeric:"tabular-nums"}}>{fmt(fab)}</span>
          </div>;
        })}
      </>;})()}
    </div>
  </Modal>;
}

// ── Reports ───────────────────────────────────────────────────────────────
function Reports({jobs,clients,quotes,payments,invoices,markupTable,setView}){
  const isMobile=useIsMobile();
  const isNarrow=useIsMobile(1024);   // tablet + phone: stack the wide trade-accounts table into cards
  // Compact money for the tight bar-chart labels on mobile (e.g. $84k) so they don't overflow.
  const compactMoney=n=>"$"+(n>=1000?Math.round(n/1000)+"k":Math.round(n));
  const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);return d.toISOString().slice(0,7);}).reverse();
  const monthData=months.map(m=>({
    month:new Date(m+"-01").toLocaleDateString(LOCALE,{month:"short",year:"numeric"}),
    paid:payments.filter(p=>p.date?.startsWith(m)&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0)
      +quotes.filter(q=>q.status==="Approved"&&(Number(q.tradeInCredit)||0)>0&&String(q.updatedAt||q.createdAt||"").slice(0,7)===m).reduce((s,q)=>s+Number(q.tradeInCredit),0),
  }));
  const maxPaid=Math.max(...monthData.map(m=>m.paid),1);
  const jobsByType=JOB_TYPES.map(t=>({type:t,count:jobs.filter(j=>j.type===t).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
  const jobsByStage=JOB_STAGES.map(s=>({stage:s,count:jobs.filter(j=>j.stage===s).length})).filter(x=>x.count>0);
  const totalQ=quotes.length;
  const appQ=quotes.filter(q=>q.status==="Approved").length;
  const conv=totalQ>0?Math.round(appQ/totalQ*100):0;
  const avgBase=totalQ>0?quotes.reduce((s,q)=>s+calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade").baseLow,0)/totalQ:0;
  const avgFinal=totalQ>0?quotes.reduce((s,q)=>{if(quoteIsManual(q))return s+Number(q.manualTotal);const c=calcQuote(q.lineItems,markupTable,effMarkupOverride(q),q.pricingMode==="trade");return s+(c.bracket?(c.isRange?c.finalHigh:c.finalLow):0);},0)/totalQ:0;
  const cashPaid=payments.filter(p=>p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const totalTradeIn=jobs.reduce((s,j)=>s+jobTradeInCredit(j,quotes),0);   // gold trade-in credits = value received
  const totalPaid=cashPaid+totalTradeIn;                                    // total value received (cash + trade-in)
  // Sales = agreed charge across all jobs (override or approved quotes)
  const totalSales=jobs.reduce((s,j)=>s+jobChargeTotal(j,quotes,markupTable,invoices),0);
  const outstanding=jobs.reduce((s,j)=>{
    const bal=jobChargeTotal(j,quotes,markupTable,invoices)-payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((a,p)=>a+Number(p.amount),0)-jobTradeInCredit(j,quotes);
    return s+(bal>1?bal:0);
  },0);
  return <div>
    <SectionHeader eyebrow="Business" title="Reports" subtitle="How the studio's tracking — sales, margins and conversion at a glance."/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(176px,1fr))",gap:12,marginBottom:22}}>
      <Stat label="Total clients" value={clients.length}/>
      <Stat label="Total jobs" value={jobs.length}/>
      <Stat label="Total sales" value={fmt(totalSales)} sub="agreed charges"/>
      <Stat label="Quote conversion" value={`${conv}%`} sub={`${appQ} of ${totalQ} approved`}/>
      <Stat label="Avg base cost" value={fmt(avgBase)}/>
      <Stat label="Avg final price" value={fmt(avgFinal)}/>
      <Stat label="Total received" value={fmt(totalPaid)} sub={totalTradeIn>0?"cash + gold trade-ins":undefined}/>
      <Stat label="Outstanding" value={fmt(outstanding)} sub="balance owed" accent={outstanding>0}/>
    </div>
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:18}}>Received (cash + trade-ins) — last 6 months</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end",height:110}}>
        {monthData.map(m=>(
          <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{fontSize:isMobile?9:10,fontWeight:700,color:m.paid>0?OK:BD,whiteSpace:"nowrap"}}>{m.paid>0?(isMobile?compactMoney(m.paid):fmt(m.paid)):""}</div>
            <div style={{width:"100%",height:`${Math.max(4,Math.round(m.paid/maxPaid*100))}%`,background:m.paid>0?OK:BD,borderRadius:"4px 4px 0 0",minHeight:4}}/>
            <div style={{fontSize:10,color:WG,textAlign:"center",whiteSpace:"nowrap"}}>{m.month}</div>
          </div>
        ))}
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card style={{margin:0}}>
        <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Jobs by type</div>
        {jobsByType.length===0?<div style={{color:WG,fontSize:14}}>No jobs yet.</div>:jobsByType.map(x=>(
          <div key={x.type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${BD}`,fontSize:13}}>
            <span style={{color:INK}}>{x.type}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:60,height:6,background:BD,borderRadius:3,overflow:"hidden"}}><div style={{width:`${Math.round(x.count/jobs.length*100)}%`,height:"100%",background:GOLD,borderRadius:3}}/></div>
              <span style={{fontWeight:700,color:INK,minWidth:16,textAlign:"right"}}>{x.count}</span>
            </div>
          </div>
        ))}
      </Card>
      <Card style={{margin:0}}>
        <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Jobs by stage</div>
        {jobsByStage.length===0?<div style={{color:WG,fontSize:14}}>No jobs yet.</div>:jobsByStage.map(x=>(
          <div key={x.stage} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${BD}`,fontSize:13}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:SC[x.stage]||WG}}/><span style={{color:INK}}>{x.stage}</span></div>
            <span style={{fontWeight:700,color:INK}}>{x.count}</span>
          </div>
        ))}
      </Card>
    </div>
    {(()=>{
      const trades=clients.filter(c=>c.accountType==="trade");
      if(!trades.length)return null;
      const rows=trades.map(c=>({c,m:accountMetrics(c,jobs,invoices,payments)})).sort((a,b)=>b.m.invoiced-a.m.invoiced);
      const tot=rows.reduce((a,{m})=>({invoiced:a.invoiced+m.invoiced,collected:a.collected+m.collected,outstanding:a.outstanding+m.outstanding,jobCount:a.jobCount+m.jobCount}),{invoiced:0,collected:0,outstanding:0,jobCount:0});
      return <Card style={{marginTop:14}}>
        <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:4}}>Trade accounts</div>
        <div style={{fontSize:12,color:WG,marginBottom:14}}>Revenue, volume and turnaround per account — heaviest first. Tap an account for its statement.</div>
        {!isNarrow&&<div style={{display:"grid",gridTemplateColumns:"1.6fr 0.7fr 1fr 1fr 1fr 0.9fr",gap:8,padding:"0 2px 8px",fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:`2px solid ${INK}`}}>
          <div>Account</div><div style={{textAlign:"right"}}>Jobs</div><div style={{textAlign:"right"}}>Invoiced</div><div style={{textAlign:"right"}}>Collected</div><div style={{textAlign:"right"}}>Outstanding</div><div style={{textAlign:"right"}}>Turnaround</div>
        </div>}
        {rows.map(({c,m})=>(
          <div key={c.id} onClick={()=>setView&&setView("statementDetail_"+c.id)} style={isNarrow
            ?{padding:"11px 2px",borderBottom:`1px solid ${BD}`,cursor:"pointer"}
            :{display:"grid",gridTemplateColumns:"1.6fr 0.7fr 1fr 1fr 1fr 0.9fr",gap:8,padding:"11px 2px",borderBottom:`1px solid ${BD}`,alignItems:"center",cursor:"pointer",fontSize:13}}
            onMouseEnter={e=>e.currentTarget.style.background=PARCH} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            {isNarrow?<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <span style={{fontWeight:700,color:INK,fontSize:14}}>{clientDisplayName(c)}</span>
                <span style={{fontWeight:800,color:INK}}>{fmtR(m.invoiced)}</span>
              </div>
              <div style={{fontSize:12,color:WG,marginTop:3}}>{m.jobCount} job{m.jobCount!==1?"s":""} · Collected {fmtR(m.collected)}{m.outstanding>0?<span style={{color:WARN,fontWeight:600}}> · {fmtR(m.outstanding)} owing</span>:""}{m.avgTurnaround!=null?` · ~${m.avgTurnaround}d`:""}</div>
            </>:<>
              <div style={{fontWeight:700,color:INK,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{clientDisplayName(c)}{c.terms&&<span style={{fontSize:10,color:WG,fontWeight:600}}> · {c.terms}</span>}</div>
              <div style={{textAlign:"right",color:INK}}>{m.jobCount}</div>
              <div style={{textAlign:"right",fontWeight:700,color:INK}}>{fmtR(m.invoiced)}</div>
              <div style={{textAlign:"right",color:OK,fontWeight:600}}>{fmtR(m.collected)}</div>
              <div style={{textAlign:"right",color:m.outstanding>0?WARN:WG,fontWeight:m.outstanding>0?700:400}}>{fmtR(m.outstanding)}</div>
              <div style={{textAlign:"right",color:WG}}>{m.avgTurnaround!=null?`~${m.avgTurnaround}d`:"—"}</div>
            </>}
          </div>
        ))}
        {rows.length>1&&!isNarrow&&<div style={{display:"grid",gridTemplateColumns:"1.6fr 0.7fr 1fr 1fr 1fr 0.9fr",gap:8,padding:"11px 2px 2px",fontSize:13,fontWeight:800,color:INK,borderTop:`2px solid ${INK}`,marginTop:2}}>
          <div>All trade accounts</div><div style={{textAlign:"right"}}>{tot.jobCount}</div><div style={{textAlign:"right"}}>{fmtR(tot.invoiced)}</div><div style={{textAlign:"right",color:OK}}>{fmtR(tot.collected)}</div><div style={{textAlign:"right",color:tot.outstanding>0?WARN:INK}}>{fmtR(tot.outstanding)}</div><div/>
        </div>}
      </Card>;
    })()}
  </div>;
}

// Compact bracket-table editor (From $ / To $ / × multiplier) — reused for the trade markup profile.
function BracketEditor({rows,setRows,accent=GOLD_D}){
  const set=(id,k,v)=>setRows(p=>p.map(b=>b.id===id?{...b,[k]:Number(v)}:b));
  const add=()=>setRows(p=>[...p,{id:uid(),low:p.length?Number(p[p.length-1].high)+0.01:0,high:0,multiplier:1.3}]);
  const del=id=>setRows(p=>p.filter(b=>b.id!==id));
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 84px 30px",gap:8,marginBottom:5,padding:"0 2px"}}>
      {["From $","To $","× mult",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>)}
    </div>
    {(rows||[]).map(b=>(
      <div key={b.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 84px 30px",gap:8,marginBottom:6,alignItems:"center"}}>
        <input type="number" value={b.low} onChange={e=>set(b.id,"low",e.target.value)} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",minWidth:0}}/>
        <input type="number" value={b.high} onChange={e=>set(b.id,"high",e.target.value)} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",minWidth:0}}/>
        <input type="number" value={b.multiplier} step="0.05" min="1" onChange={e=>set(b.id,"multiplier",e.target.value)} style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:700,padding:"5px 8px",color:accent,minWidth:0}}/>
        <button onClick={()=>del(b.id)} style={{background:"none",border:"none",color:DANGER,cursor:"pointer",fontSize:16,fontFamily:"inherit",lineHeight:1}} title="Remove tier">×</button>
      </div>
    ))}
    <button onClick={add} style={{background:"none",border:`1px dashed ${accent}`,borderRadius:4,padding:"6px 14px",color:accent,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>+ Add tier</button>
  </div>;
}

// ── Settings ──────────────────────────────────────────────────────────────
function Settings({biz,setBiz,markupTable,setMarkupTable,naturalStoneMarkup,setNaturalStoneMarkup,labStoneMarkup,setLabStoneMarkup,tradeMarkupTable=[],setTradeMarkupTable,tradeNatStoneMarkup=[],setTradeNatStoneMarkup,tradeLabStoneMarkup=[],setTradeLabStoneMarkup,dataSafety,billing}){
  const isMobile=useIsMobile();
  const[bForm,setBForm]=useState({name:"",email:"",phone:"",abn:"",address:"",depositPercent:50,quoteValidityDays:30,quoteTerms:"",bankName:"Commonwealth Bank of Australia",bankAccountName:"",bankBSB:"",bankAccount:"",...biz});
  const setBF=k=>v=>setBForm(p=>({...p,[k]:v}));
  const[mt,setMt]=useState(markupTable.map(b=>({...b})));
  const[buffer,setBuffer]=useState(String(biz.markupBuffer||0));
  const[rounding,setRounding]=useState(String(biz.quoteRounding||0));
  const setMtRow=(id,k,v)=>setMt(p=>p.map(b=>b.id===id?{...b,[k]:v}:b));
  const[smn,setSmn]=useState((naturalStoneMarkup||[]).map(b=>({...b})));
  const setSmNRow=(id,k,v)=>setSmn(p=>p.map(b=>b.id===id?{...b,[k]:v}:b));
  const addSmNRow=()=>setSmn(p=>[...p,{id:uid(),low:p.length?p[p.length-1].high+0.01:0,high:0,multiplier:1.5}]);
  const delSmNRow=id=>setSmn(p=>p.filter(b=>b.id!==id));
  const[sml,setSml]=useState((labStoneMarkup||[]).map(b=>({...b})));
  const setSmLRow=(id,k,v)=>setSml(p=>p.map(b=>b.id===id?{...b,[k]:v}:b));
  const addSmLRow=()=>setSml(p=>[...p,{id:uid(),low:p.length?p[p.length-1].high+0.01:0,high:0,multiplier:1.5}]);
  const delSmLRow=id=>setSml(p=>p.filter(b=>b.id!==id));
  const[toast,setToast]=useState(null);
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2400);};
  // Preserve markup-table-owned settings (buffer / rounding) so saving business details can't wipe them.
  const saveBiz=()=>{
    const nb={...bForm,calendarToken:biz.calendarToken,calendarTz:biz.calendarTz,markupBuffer:biz.markupBuffer||0,quoteRounding:biz.quoteRounding||0};
    setBiz(nb);persist(K.biz,nb);
    // Sync this studio's name + acceptance-notification email to the studios table, so the
    // server-side email function can reach the right studio. RLS lets an owner update its studio.
    if(_studioId&&supabaseEnabled&&supabase){
      const patch={notify_email:(nb.notifyEmail||nb.email||"").trim()||null};
      if((nb.name||"").trim())patch.name=nb.name.trim();
      supabase.from("studios").update(patch).eq("id",_studioId).then(()=>{}).catch(()=>{});
    }
    showToast("Business details saved");
  };
  // Region & currency: choosing a preset fills the currency + tax fields (still editable after).
  const applyPreset=key=>{const p=REGION_PRESETS[key];if(!p)return;setBForm(f=>({...f,region:key,currencySymbol:p.sym,currencyCode:p.code,taxLabel:p.taxLabel,taxRatePct:p.taxPct,locale:p.locale,taxIdLabel:p.taxId}));};
  const saveMt=()=>{setMarkupTable(mt);persist(K.mt,mt);const nb={...biz,markupBuffer:Number(buffer)||0,quoteRounding:Number(rounding)||0};setBiz(nb);persist(K.biz,nb);setMarkupBuffer(Number(buffer)||0);setQuoteRounding(Number(rounding)||0);showToast("Markup table saved");};
  // Calendar subscription feed — a private token stored in biz settings; the calendar-feed edge fn serves the .ics.
  const browserTz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"";}catch(e){return "";}})();
  const genFeedToken=()=>{const t=(uid()+uid()+uid()+Date.now().toString(36)).replace(/[^a-z0-9]/gi,"").slice(0,32);const nb={...biz,calendarToken:t,calendarTz:browserTz||biz.calendarTz||""};setBiz(nb);persist(K.biz,nb);showToast("Calendar link created");};
  // Backfill the timezone for a token created before we stored it, so the feed renders times correctly without a new URL.
  useEffect(()=>{if(biz.calendarToken&&!biz.calendarTz&&browserTz){const nb={...biz,calendarTz:browserTz};setBiz(nb);persist(K.biz,nb);}},[biz.calendarToken,biz.calendarTz,browserTz]);
  const feedUrl=calFeedUrl(biz.calendarToken);
  const saveSmNTable=()=>{setNaturalStoneMarkup(smn);persist(K.smn,smn);showToast("Natural stone markup saved");};
  const saveSmLTable=()=>{setLabStoneMarkup(sml);persist(K.sml,sml);showToast("Lab-grown stone markup saved");};
  // Trade markup profile — lower wholesale markups, applied to trade-account quotes.
  const[tmt,setTmt]=useState((tradeMarkupTable||[]).map(b=>({...b})));
  const[tsn,setTsn]=useState((tradeNatStoneMarkup||[]).map(b=>({...b})));
  const[tsl,setTsl]=useState((tradeLabStoneMarkup||[]).map(b=>({...b})));
  const saveTrade=()=>{setTradeMarkupTable(tmt);persist(K.tmt,tmt);setTradeNatStoneMarkup(tsn);persist(K.tsmn,tsn);setTradeLabStoneMarkup(tsl);persist(K.tsml,tsl);showToast("Trade markups saved");};

  return <div>
    {toast&&<div style={{position:"fixed",top:18,right:24,background:OK,color:WHITE,fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:4,boxShadow:"0 4px 18px rgba(0,0,0,0.18)",zIndex:9999,letterSpacing:"0.04em"}}>✓ {toast}</div>}
    <SectionHeader eyebrow="Your studio" title="Settings" subtitle="Business details, branding, pricing rules and your calendar feed."/>
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:4}}>Business details</div>
      <div style={{fontSize:13,color:WG,marginBottom:16}}>These appear on printed proposals and invoices.</div>
      {/* Logo uploader */}
      <div style={{marginBottom:18}}>
        <label style={SS.lbl}>Business logo</label>
        <div style={{display:"flex",alignItems:"center",gap:16,marginTop:8}}>
          <div style={{width:90,height:90,borderRadius:5,border:`1px solid ${BD}`,background:PARCH,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
            {bForm.logo?<img src={bForm.logo} alt="Logo" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:<span style={{fontSize:11,color:WG}}>No logo</span>}
          </div>
          <div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <label style={{background:INK,color:WHITE,borderRadius:3,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
                {bForm.logo?"Replace logo":"Upload logo"}
                <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                  const f=e.target.files?.[0];e.target.value="";if(!f)return;
                  try{const url=await fileToLogoDataUrl(f);setBForm(p=>({...p,logo:url}));}catch(err){alert("Couldn't load that image.");}
                }}/>
              </label>
              {bForm.logo&&<button onClick={()=>setBForm(p=>({...p,logo:""}))} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:13,fontWeight:700,fontFamily:"inherit"}}>Remove</button>}
            </div>
            <div style={{fontSize:11,color:WG,marginTop:8,lineHeight:1.5,maxWidth:300}}>PNG or JPG. Appears in the sidebar and on your invoices &amp; proposals. Click <strong>Save business details</strong> below to apply.</div>
          </div>
        </div>
      </div>
      <Input label="Business name" value={bForm.name} onChange={setBF("name")} placeholder="Mitchell Fine Jewellery"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Input label="Email" value={bForm.email} onChange={setBF("email")} placeholder="hello@studio.com.au"/>
        <Input label="Phone" value={bForm.phone} onChange={setBF("phone")} placeholder="(03) 9123 4567"/>
        <Input label={TAX_ID_LABEL} value={bForm.abn} onChange={setBF("abn")} placeholder="12 345 678 901"/>
      </div>
      <Input label="Address" value={bForm.address} onChange={setBF("address")} placeholder="123 Collins St, Melbourne VIC 3000"/>
      <div style={{margin:"6px 0 4px",padding:"12px 14px",background:PARCH,border:`1px solid ${BD}`,borderRadius:5}}>
        <Input label="Proposal-acceptance alerts — email" value={bForm.notifyEmail||""} onChange={setBF("notifyEmail")} placeholder={bForm.email||"you@studio.com.au"}/>
        <div style={{fontSize:11,color:WG,marginTop:2,lineHeight:1.5}}>We'll email this address the moment a client accepts one of your online proposals — so you know even with the app closed. Leave blank to use your business email above.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Input label={<>Deposit required (%)<InfoDot text="The default deposit you ask for up front. On a bundle proposal it pre-fills 'Amount due now'; on single-option proposals the client's page works out this % of whichever option they pick."/></>} value={String(bForm.depositPercent)} onChange={v=>setBF("depositPercent")(Number(v)||50)} type="number" placeholder="50"/>
        <Input label={<>Quote validity (days)<InfoDot text="How long a sent quote/proposal stays valid. After this many days the client's link expires (so they can't accept stale pricing) and the quote drops out of your dashboard pipeline."/></>} value={String(bForm.quoteValidityDays)} onChange={v=>setBF("quoteValidityDays")(Number(v)||30)} type="number" placeholder="30"/>
      </div>
      <Input label="Terms & conditions (shown on quote proposals)" value={bForm.quoteTerms} onChange={setBF("quoteTerms")} as="textarea" rows={5} placeholder="All custom jewellery requires a deposit before work commences..."/>
      <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${BD}`}}>
        <div style={{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Invoice numbering</div>
        <div style={{fontSize:11,color:WG,marginBottom:12,lineHeight:1.5}}>Optional. Set a prefix and a starting number so the app's invoice numbers line up with your Xero / MYOB sequence. You can also override the number on any individual invoice from that invoice. Leave both blank to keep the default 00001001 style.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Input label="Invoice prefix (optional)" value={bForm.invoicePrefix||""} onChange={setBF("invoicePrefix")} placeholder="e.g. INV-"/>
          <Input label="Start numbering from (optional)" value={bForm.invoiceStart||""} onChange={setBF("invoiceStart")} type="number" placeholder="e.g. 1042"/>
        </div>
      </div>
      <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${BD}`}}>
        <div style={{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Bank &amp; payment details <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(shown on printed invoices)</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Input label="Bank name" value={bForm.bankName||""} onChange={setBF("bankName")} placeholder="Commonwealth Bank of Australia"/>
          <Input label="Account name" value={bForm.bankAccountName||""} onChange={setBF("bankAccountName")} placeholder="VAHÉ Jewellery"/>
          <Input label="BSB" value={bForm.bankBSB||""} onChange={setBF("bankBSB")} placeholder="063 626"/>
          <Input label="Account number" value={bForm.bankAccount||""} onChange={setBF("bankAccount")} placeholder="1051 9975"/>
        </div>
        <div style={{marginTop:14}}>
          <Input label="Online payment link (optional)" value={bForm.paymentLink||""} onChange={setBF("paymentLink")} placeholder="https://buy.stripe.com/…  or  https://paypal.me/…"/>
          <div style={{fontSize:11,color:WG,marginTop:2,lineHeight:1.5}}>Paste your own Stripe, PayPal or bank "pay" link. A <strong style={{color:INK}}>Pay online</strong> button appears on the invoice you send clients, taking them straight to it — no integration needed. Create a "customer chooses amount" link so it works for any invoice. Leave blank to only show bank-transfer details.</div>
        </div>
      </div>
      <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${BD}`}}>
        <div style={{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Client emails</div>
        <Input label="Google review link (optional)" value={bForm.googleReviewUrl||""} onChange={setBF("googleReviewUrl")} placeholder="https://g.page/r/…  or your Google review short link"/>
        <div style={{fontSize:11,color:WG,marginTop:2,lineHeight:1.5}}>When set, a <strong style={{color:INK}}>Review us on Google</strong> button is added to the "ready for collection" email you send clients. You'll find the link in your Google Business Profile under "Ask for reviews".</div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={saveBiz}>Save business details</Btn></div>
    </Card>

    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:4}}>Region &amp; currency</div>
      <div style={{fontSize:13,color:WG,marginBottom:16}}>Sets the currency and tax shown on your quotes, proposals and invoices. Pick a region to fill the defaults, then fine-tune if needed.</div>
      <Input label="Region preset" value={bForm.region||"AU"} onChange={applyPreset} as="select" options={Object.entries(REGION_PRESETS).map(([k,p])=>({value:k,label:p.label}))}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 16px"}}>
        <Input label="Currency symbol" value={bForm.currencySymbol??"$"} onChange={setBF("currencySymbol")} placeholder="$"/>
        <Input label="Currency code" value={bForm.currencyCode??"AUD"} onChange={setBF("currencyCode")} placeholder="AUD"/>
        <Input label="Tax label" value={bForm.taxLabel??"GST"} onChange={setBF("taxLabel")} placeholder="GST"/>
        <Input label="Tax rate (%)" value={String(bForm.taxRatePct??10)} onChange={v=>setBF("taxRatePct")(v===""?"":Number(v))} type="number" min="0" step="0.1" placeholder="10"/>
      </div>
      <Input label="Business / tax number label (shown on invoices &amp; proposals)" value={bForm.taxIdLabel??"ABN"} onChange={setBF("taxIdLabel")} placeholder="ABN"/>
      <div style={{fontSize:12,color:WG,marginTop:2,lineHeight:1.6}}>Preview: your prices will show as <strong style={{color:INK}}>{bForm.currencySymbol||"$"}1,234.50 {bForm.currencyCode||"AUD"}</strong>, with {Number(bForm.taxRatePct??10)}% {bForm.taxLabel||"GST"} included in the total. Set the tax rate to <strong>0</strong> if you don't charge sales tax.</div>
      <label style={{display:"flex",alignItems:"flex-start",gap:9,fontSize:13,color:INK,cursor:"pointer",margin:"14px 0 2px"}}>
        <input type="checkbox" checked={!!bForm.stoneTaxInclusive} onChange={e=>setBF("stoneTaxInclusive")(e.target.checked)} style={{width:16,height:16,accentColor:GOLD,cursor:"pointer",marginTop:2,flexShrink:0}}/>
        <span>Centre-stone prices are tax-<strong>inclusive</strong> (marked-up stone already includes {bForm.taxLabel||"GST"})</span>
      </label>
      <div style={{fontSize:11.5,color:WG,marginTop:2,lineHeight:1.55}}>Off (default): the {bForm.taxLabel||"GST"} is <strong>added on top</strong> of the marked-up stone — cost × markup, then + {Number(bForm.taxRatePct??10)}%. On: the marked-up stone price <strong>already includes</strong> {bForm.taxLabel||"GST"}, and the tax is backed out as a component. Applies to all sourced &amp; accent stones.</div>
      <div style={{background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:4,padding:"10px 14px",marginTop:12,fontSize:11.5,color:GOLD_D,lineHeight:1.5}}>Prices are tax-<strong>inclusive</strong> — the tax is shown as a component of the total (the way AU, UK, NZ and EU retail work). US-style sales tax added on top at checkout isn't supported yet.</div>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}><Btn onClick={saveBiz}>Save region &amp; currency</Btn></div>
    </Card>

    {/* Calendar subscription feed */}
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:4}}>Subscribe to your appointments calendar</div>
      <div style={{fontSize:13,color:WG,marginBottom:14,lineHeight:1.6}}>Add this one private link to Google Calendar, Apple Calendar or Outlook and your appointments appear automatically and keep updating — no logins. <span style={{color:INK}}>Google refreshes subscribed calendars slowly (often several hours);</span> Apple and Outlook are quicker. For an instant add, use the <strong style={{color:INK}}>Add to calendar</strong> buttons on each appointment instead.</div>
      {feedUrl
        ?<div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",background:PARCH,border:`1px solid ${BD}`,borderRadius:8,padding:"10px 12px"}}>
            <span style={{flex:1,minWidth:180,fontSize:12,color:WG,wordBreak:"break-all",fontFamily:"monospace"}}>{feedUrl}</span>
            <Btn sm onClick={()=>{navigator.clipboard?.writeText(feedUrl).catch(()=>{});showToast("Feed link copied");}}>Copy link</Btn>
          </div>
          <div style={{fontSize:11.5,color:WG,marginTop:10,lineHeight:1.6}}>In <strong style={{color:INK}}>Google Calendar</strong>: Other calendars → <strong>+</strong> → <strong>From URL</strong> → paste. In <strong style={{color:INK}}>Apple Calendar</strong>: File → New Calendar Subscription. Keep this link private — anyone with it can see your appointments. <button onClick={genFeedToken} style={{background:"none",border:"none",padding:0,color:GOLD_D,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:11.5,textDecoration:"underline"}}>Reset link</button></div>
        </div>
        :<Btn sm onClick={genFeedToken}>Generate my calendar link</Btn>}
    </Card>

    {/* Markup table editor */}
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:4,display:"flex",alignItems:"center"}}>Markup table<InfoDot text="Retail price = your cost × the multiplier for its cost bracket, then rounded. This table sets those tiers; the quote builder picks the right one automatically. Bigger jobs usually carry a lower multiplier."/></div>
      <div style={{fontSize:13,color:WG,marginBottom:16,lineHeight:1.6}}>Your tiered multiplier table. The quote builder uses this to find the right bracket and calculate your final price automatically. Adjust any row and save.</div>
      <div style={{background:WHITE,borderRadius:5,border:`1px solid ${BD}`,overflow:"hidden",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr) auto":"1fr 1fr 120px",columnGap:isMobile?7:0,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {[`Cost from (${CUR_SYM})`,`Cost to (${CUR_SYM})`,"Multiplier"].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {mt.map((b,i)=>{
          const exGST=1000;
          const finalEx=exGST*b.multiplier;
          return <div key={b.id} style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr) auto":"1fr 1fr 120px",columnGap:isMobile?7:0,padding:"8px 16px",borderBottom:i<mt.length-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"88"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG,marginRight:2}}>$</span>
              <input type="number" value={b.low} onChange={e=>setMtRow(b.id,"low",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:isMobile?"100%":100,minWidth:0}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG,marginRight:2}}>$</span>
              <input type="number" value={b.high} onChange={e=>setMtRow(b.id,"high",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:isMobile?"100%":100,minWidth:0}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={b.multiplier} onChange={e=>setMtRow(b.id,"multiplier",Number(e.target.value))} step="0.1" min="1" style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:700,padding:"5px 8px",width:isMobile?52:70,color:GOLD_D}}/>            </div>
          </div>;
        })}
      </div>
      <div style={{borderTop:`1px solid ${BD}`,margin:"4px 0 18px"}}/>
      <div style={{fontWeight:700,fontSize:13,color:INK,marginBottom:14}}>Pricing options</div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?22:28,marginBottom:16}}>
        <div>
          <label style={SS.lbl}>{`Bracket threshold buffer (${CUR_SYM})`}</label>
          <div style={{position:"relative",marginTop:4}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>{CUR_SYM}</span>
            <input type="number" value={buffer} onChange={e=>setBuffer(e.target.value)} min="0" step="10" style={{...SS.inp,marginTop:0,paddingLeft:28}}/>
          </div>
          <div style={{fontSize:12,color:WG,lineHeight:1.6,marginTop:8}}>If a cost is within this much of the next bracket, it's bumped up to that bracket's (lower) multiplier — so a cost just under a threshold doesn't get charged the higher markup. Set to <strong style={{color:INK}}>0</strong> to disable. Example: a {CUR_SYM}100 buffer means a {CUR_SYM}920 cost is priced as if it were in the {CUR_SYM}1,000+ bracket.</div>
        </div>
        <div>
          <label style={SS.lbl}>Round quote prices</label>
          <select value={rounding} onChange={e=>setRounding(e.target.value)} style={{...SS.inp,marginTop:4}}>
            <option value="0">Off — exact figures</option>
            <option value="5">Nearest {CUR_SYM}5</option>
            <option value="10">Nearest {CUR_SYM}10</option>
            <option value="25">Nearest {CUR_SYM}25</option>
            <option value="50">Nearest {CUR_SYM}50</option>
            <option value="100">Nearest {CUR_SYM}100</option>
          </select>
          <div style={{fontSize:12,color:WG,lineHeight:1.6,marginTop:8}}>Rounds every calculated quote price — jewellery, stones and totals — so quotes don't land on odd figures. Example: nearest {CUR_SYM}10 turns <strong style={{color:INK}}>{CUR_SYM}4,587</strong> into <strong style={{color:INK}}>{CUR_SYM}4,590</strong>; nearest {CUR_SYM}50 makes it <strong style={{color:INK}}>{CUR_SYM}4,600</strong>. Manual quoted prices are never rounded. Applies everywhere prices are recalculated, including existing quotes.</div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={saveMt}>Save markup table</Btn></div>
    </Card>

    {/* Stone markup tables */}
    <div style={{marginBottom:10,paddingTop:4}}>
      <div style={{fontSize:13,fontWeight:700,color:INK,marginBottom:4}}>Stone markup tables</div>
      <div style={{fontSize:13,color:WG,lineHeight:1.6}}>Two separate markup tables for centre &amp; feature stones — one for natural, one for lab-grown. Applied in the quote builder based on stone type. {STONE_TAX_INCLUSIVE?<>{TAX_LABEL} ({Math.round(GST_RATE*100)}%) is included within the marked-up price.</>:<>{TAX_LABEL} ({Math.round(GST_RATE*100)}%) is added at invoice time on top of the marked-up price.</>}</div>
    </div>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",rowGap:6,marginBottom:6}}>
        <div style={{background:"#4E8B6A",color:WHITE,borderRadius:3,padding:"4px 12px",fontSize:10.5,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Natural Diamond &amp; Gemstone</div>
      </div>
      <div style={{fontSize:12,color:WG,marginBottom:14,lineHeight:1.5}}>"Natural" is selected in the quote builder stone section. <strong style={{color:INK}}>{STONE_TAX_INCLUSIVE?<>{TAX_LABEL} included in the marked-up price.</>:<>{TAX_LABEL} added at invoice time.</>}</strong></div>
      <div style={{background:WHITE,borderRadius:4,border:`1px solid ${BD}`,overflow:"hidden",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr) auto auto":"1fr 1fr 130px 44px",columnGap:isMobile?7:0,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {[`Cost from (${CUR_SYM})`,`Cost to (${CUR_SYM})`,"Multiplier",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {smn.map((b,i)=>(
          <div key={b.id} style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr) auto auto":"1fr 1fr 130px 44px",columnGap:isMobile?7:0,padding:"8px 16px",borderBottom:i<smn.length-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"88"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.low} onChange={e=>setSmNRow(b.id,"low",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:isMobile?"100%":100,minWidth:0}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.high} onChange={e=>setSmNRow(b.id,"high",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:isMobile?"100%":100,minWidth:0}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={b.multiplier} onChange={e=>setSmNRow(b.id,"multiplier",Number(e.target.value))} step="0.01" min="1"
                style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:700,padding:"5px 8px",width:isMobile?52:80,color:"#4E8B6A"}}/>            </div>
            <button onClick={()=>delSmNRow(b.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,justifySelf:"center"}}>×</button>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,rowGap:12,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={addSmNRow} style={{background:"none",border:"1px dashed #4E8B6A",borderRadius:4,padding:"6px 14px",color:"#4E8B6A",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add tier</button>
        <Btn onClick={saveSmNTable}>Save natural stone markup</Btn>
      </div>
    </Card>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",rowGap:6,marginBottom:6}}>
        <div style={{background:"#96627C",color:WHITE,borderRadius:3,padding:"4px 12px",fontSize:10.5,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Lab-Grown Diamond &amp; Gemstone</div>
      </div>
      <div style={{fontSize:12,color:WG,marginBottom:14,lineHeight:1.5}}>"Lab-Grown" is selected in the quote builder stone section. <strong style={{color:INK}}>{STONE_TAX_INCLUSIVE?<>{TAX_LABEL} included in the marked-up price.</>:<>{TAX_LABEL} added at invoice time.</>}</strong></div>
      <div style={{background:WHITE,borderRadius:4,border:`1px solid ${BD}`,overflow:"hidden",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr) auto auto":"1fr 1fr 130px 44px",columnGap:isMobile?7:0,padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {[`Cost from (${CUR_SYM})`,`Cost to (${CUR_SYM})`,"Multiplier",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {sml.map((b,i)=>(
          <div key={b.id} style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr) auto auto":"1fr 1fr 130px 44px",columnGap:isMobile?7:0,padding:"8px 16px",borderBottom:i<sml.length-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"88"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.low} onChange={e=>setSmLRow(b.id,"low",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:isMobile?"100%":100,minWidth:0}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.high} onChange={e=>setSmLRow(b.id,"high",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:isMobile?"100%":100,minWidth:0}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={b.multiplier} onChange={e=>setSmLRow(b.id,"multiplier",Number(e.target.value))} step="0.01" min="1"
                style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:700,padding:"5px 8px",width:isMobile?52:80,color:"#96627C"}}/>            </div>
            <button onClick={()=>delSmLRow(b.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,justifySelf:"center"}}>×</button>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,rowGap:12,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={addSmLRow} style={{background:"none",border:"1px dashed #96627C",borderRadius:4,padding:"6px 14px",color:"#96627C",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add tier</button>
        <Btn onClick={saveSmLTable}>Save lab-grown stone markup</Btn>
      </div>
    </Card>

    {/* Trade markup profile — lower wholesale markups for trade-account clients */}
    <div style={{marginBottom:10,paddingTop:4}}>
      <div style={{fontSize:13,fontWeight:700,color:INK,marginBottom:4}}>Trade markups <span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",color:GOLD_D,background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:999,padding:"2px 8px",textTransform:"uppercase",marginLeft:6}}>Wholesale</span></div>
      <div style={{fontSize:13,color:WG,lineHeight:1.6}}>Your lower markups for trade accounts. Quotes for a trade-account client price through these instead of your retail markups (the quote builder has a Retail/Trade toggle). Seeded as a copy of your retail markups — lower them to your wholesale rates. Same brackets, same method, different numbers.</div>
    </div>
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:10}}>Markup table (Trade)</div>
      <BracketEditor rows={tmt} setRows={setTmt}/>
      <div style={{borderTop:`1px solid ${BD}`,margin:"20px 0 14px"}}/>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",rowGap:6,marginBottom:10}}>
        <div style={{background:"#4E8B6A",color:WHITE,borderRadius:3,padding:"4px 12px",fontSize:10.5,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Natural Diamond &amp; Gemstone (Trade)</div>
      </div>
      <BracketEditor rows={tsn} setRows={setTsn} accent="#4E8B6A"/>
      <div style={{borderTop:`1px solid ${BD}`,margin:"20px 0 14px"}}/>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",rowGap:6,marginBottom:10}}>
        <div style={{background:"#96627C",color:WHITE,borderRadius:3,padding:"4px 12px",fontSize:10.5,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Lab-Grown Diamond &amp; Gemstone (Trade)</div>
      </div>
      <BracketEditor rows={tsl} setRows={setTsl} accent="#96627C"/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><Btn onClick={saveTrade}>Save trade markups</Btn></div>
    </Card>
    {billing&&billing.enabled&&<><SectionHeader eyebrow="Your studio" title="Subscription" subtitle="Your Workshop Pilot plan and billing."/><BillingCard billing={billing}/></>}
    {supabaseEnabled&&<><SectionHeader eyebrow="Your studio" title="Team" subtitle="Invite teammates into this studio — everyone shares the same jobs, clients and invoices."/><TeamCard/></>}
    <SectionHeader eyebrow="Your studio" title="Data safety" subtitle="Automatic backups you can restore from — so nothing gets lost for good."/>
    {dataSafety&&<DataSafetyCard {...dataSafety}/>}
  </div>;
}
// Team management — invite teammates into this studio via a shareable link, list members, remove
// them. Backed by the team-invites.sql RPCs. Every member gets full access; only owner/admin manage.
function TeamCard(){
  const[members,setMembers]=useState(null);
  const[invites,setInvites]=useState([]);
  const[me,setMe]=useState(null);
  const[link,setLink]=useState("");
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState("");
  const[copied,setCopied]=useState(false);
  const load=useCallback(async()=>{
    setErr("");
    try{
      const{data:u}=await supabase.auth.getUser();setMe(u?.user||null);
      const{data:m,error}=await supabase.rpc("list_studio_members");
      if(error)throw error;
      setMembers(m||[]);
      const{data:iv}=await supabase.from("studio_invites").select("token,role,email,created_at").is("accepted_at",null).order("created_at",{ascending:false});
      setInvites(iv||[]);
    }catch(e){setMembers([]);setErr(e.message||"Couldn't load your team — the team-invites database migration may not be run yet.");}
  },[]);
  useEffect(()=>{load();},[load]);
  const myRole=(members&&me)?(members.find(x=>x.user_id===me.id)?.role||null):null;
  const canManage=myRole==="owner"||myRole==="admin";
  const inviteUrl=t=>`${window.location.origin}/?invite=${t}`;
  const makeInvite=async()=>{
    setBusy(true);setErr("");setCopied(false);setLink("");
    try{
      const{data:token,error}=await supabase.rpc("create_studio_invite",{p_role:"staff",p_email:null});
      if(error)throw error;
      setLink(inviteUrl(token));load();
    }catch(e){setErr(e.message||"Couldn't create an invite.");}
    setBusy(false);
  };
  const copy=async(text)=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch(e){}};
  const revoke=async(t)=>{if(!confirm("Revoke this invite link? Anyone still holding it won't be able to join."))return;try{await supabase.rpc("revoke_studio_invite",{p_token:t});load();}catch(e){setErr(e.message||"Couldn't revoke the invite.");}};
  const remove=async(uid,email)=>{if(!confirm(`Remove ${email||"this teammate"} from your studio? They'll immediately lose access.`))return;try{const{error}=await supabase.rpc("remove_studio_member",{p_user:uid});if(error)throw error;load();}catch(e){setErr(e.message||"Couldn't remove the member.");}};
  const roleColor=r=>r==="owner"?GOLD_D:r==="admin"?"#6E67A0":WG;
  return <Card>
    {err&&<div style={{background:DANGER+"14",border:`1px solid ${DANGER}44`,color:DANGER,fontSize:12.5,padding:"9px 12px",borderRadius:6,marginBottom:14,lineHeight:1.5}}>{err}</div>}
    {members===null
      ?<div style={{fontSize:13,color:WG}}>Loading team…</div>
      :<>
        <div style={{display:"flex",flexDirection:"column"}}>
          {members.map(m=><div key={m.user_id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:`1px solid ${BD}`}}>
            <div style={{fontSize:14,fontWeight:600,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{m.email}{me&&m.user_id===me.id&&<span style={{color:WG,fontWeight:400}}> · you</span>}</div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
              <span style={{fontSize:10.5,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:roleColor(m.role)}}>{m.role}</span>
              {canManage&&m.role!=="owner"&&m.user_id!==me?.id&&<button onClick={()=>remove(m.user_id,m.email)} style={{background:"none",border:`1px solid ${DANGER}44`,borderRadius:4,padding:"3px 9px",fontSize:11,color:DANGER,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Remove</button>}
            </div>
          </div>)}
        </div>
        {canManage&&<>
          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:16,flexWrap:"wrap"}}>
            <Btn sm onClick={makeInvite} disabled={busy}>{busy?"Creating…":"+ Invite teammate"}</Btn>
            <span style={{fontSize:12,color:WG}}>Generates a link — send it to them however you like.</span>
          </div>
          {link&&<div style={{marginTop:12,background:PARCH,border:`1px solid ${BD}`,borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Invite link</div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input readOnly value={link} onFocus={e=>e.target.select()} style={{...SS.inp,marginTop:0,flex:1,minWidth:180,fontSize:12.5}}/>
              <Btn sm onClick={()=>copy(link)}>{copied?"Copied ✓":"Copy"}</Btn>
            </div>
            <div style={{fontSize:11.5,color:WG,marginTop:8,lineHeight:1.5}}>They open this link, create their account, and join your studio automatically.</div>
          </div>}
          {invites.length>0&&<div style={{marginTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Pending invites ({invites.length})</div>
            {invites.map(iv=><div key={iv.token} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 0",borderBottom:`1px solid ${BD}`}}>
              <div style={{fontSize:12.5,color:WG,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>…/?invite={iv.token.slice(0,10)}… · {iv.role}</div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>copy(inviteUrl(iv.token))} style={{background:"none",border:`1px solid ${BD}`,borderRadius:4,padding:"3px 9px",fontSize:11,color:INK,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Copy link</button>
                <button onClick={()=>revoke(iv.token)} style={{background:"none",border:`1px solid ${DANGER}44`,borderRadius:4,padding:"3px 9px",fontSize:11,color:DANGER,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Revoke</button>
              </div>
            </div>)}
          </div>}
        </>}
        {!canManage&&<div style={{fontSize:12.5,color:WG,marginTop:10,lineHeight:1.5}}>Only the studio owner or an admin can invite or remove teammates.</div>}
      </>}
  </Card>;
}
// Subscription status + subscribe/manage. Only rendered when billing is enabled for the deploy.
function BillingCard({billing}){
  const[busy,setBusy]=useState("");
  const[err,setErr]=useState("");
  const act=async(action,plan)=>{setBusy(plan||action);setErr("");try{await goBilling(action,plan);}catch(e){setErr(e?.message||"Something went wrong.");setBusy("");}};
  const statusLine=billing.active?`Active — ${billing.plan==="annual"?"annual":"monthly"} plan${billing.periodEnd?`, renews ${fmtDate(billing.periodEnd)}`:""}`
    :billing.trialLive?`Free trial — ${billing.daysLeft} day${billing.daysLeft===1?"":"s"} left`
    :billing.status==="past_due"?"Payment failed — please update your card"
    :"No active subscription";
  const col=billing.active?OK:billing.lapsed||billing.status==="past_due"?DANGER:GOLD_D;
  return <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:10}}>
      <div>
        <div style={{fontWeight:700,fontSize:15,color:INK}}>Plan</div>
        <div style={{fontSize:13,fontWeight:700,color:col,marginTop:3}}>{statusLine}</div>
      </div>
      {billing.active&&<Btn sm ghost onClick={()=>act("portal")} disabled={!!busy}>{busy==="portal"?"Opening…":"Manage billing"}</Btn>}
    </div>
    {!billing.active&&<>
      <div style={{fontSize:13,color:WG,lineHeight:1.6,marginBottom:14}}>{billing.lapsed?"Subscribe to keep adding and editing — all your data stays safe and viewable in the meantime.":"Choose a plan to continue after your trial. Cancel anytime."}</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Btn onClick={()=>act("checkout","monthly")} disabled={!!busy}>{busy==="monthly"?"Redirecting…":"Subscribe monthly"}</Btn>
        <Btn ghost onClick={()=>act("checkout","annual")} disabled={!!busy}>{busy==="annual"?"Redirecting…":"Subscribe annually (save)"}</Btn>
      </div>
    </>}
    {err&&<div style={{fontSize:13,color:DANGER,marginTop:12,lineHeight:1.5}}>{err}</div>}
    <div style={{fontSize:11,color:WG,marginTop:14,lineHeight:1.5}}>Secure payment via Stripe. You'll be redirected to Stripe to enter card details — we never see or store them.</div>
  </Card>;
}
// Backups list + restore. Backups are taken automatically (see App); this just views/restores them.
function DataSafetyCard({backupNow,loadSnapshots,restoreSnapshot}){
  const[snaps,setSnaps]=useState(null);
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");
  const refresh=async()=>{try{setSnaps(await loadSnapshots());}catch(e){setSnaps([]);}};
  useEffect(()=>{refresh();},[]);   // eslint-disable-line
  const fmtWhen=ts=>{try{return new Date(ts).toLocaleString(LOCALE,{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});}catch(e){return String(ts||"");}};
  const reasonLabel=r=>r==="manual"?"Manual backup":r==="before restore"?"Before a restore":r==="session start"?"Session start":"Auto";
  const doBackup=async()=>{setBusy(true);setMsg("");try{const ts=await backupNow();await refresh();setMsg(ts?"✓ Backed up just now.":"Couldn't back up — check you're online.");}catch(e){setMsg("Couldn't back up.");}setBusy(false);};
  const doRestore=async(entry)=>{
    const s=entry.summary||{};
    if(!confirm(`Restore ALL your data to the backup from ${fmtWhen(entry.ts)}?\n\nThis replaces your current clients, jobs, quotes, invoices, payments and settings with that backup (${s.clients||0} clients · ${s.jobs||0} jobs · ${s.invoices||0} invoices).\n\nA backup of your current data is taken first, so you can undo this.`))return;
    setBusy(true);setMsg("");try{await restoreSnapshot(entry);await refresh();setMsg("✓ Restored. Your previous data was backed up first — restore that entry to undo.");}catch(e){setMsg("Restore failed — nothing was changed.");}setBusy(false);
  };
  return <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:6}}>
      <div style={{fontWeight:700,fontSize:15,color:INK}}>Backups</div>
      <Btn sm ghost onClick={doBackup} disabled={busy}>{busy?"Working…":"⬇ Back up now"}</Btn>
    </div>
    <div style={{fontSize:13,color:WG,lineHeight:1.6,marginBottom:14}}>Backups run automatically when you open the app and every 20 minutes while you work. If something goes missing, restore an earlier point — your current data is backed up first, so a restore can itself be undone.</div>
    {msg&&<div style={{fontSize:12.5,color:OK,fontWeight:700,marginBottom:12,lineHeight:1.5}}>{msg}</div>}
    {snaps===null?<div style={{fontSize:13,color:WG}}>Loading backups…</div>
     :snaps.length===0?<div style={{fontSize:13,color:WG}}>No backups yet — one is taken automatically a few seconds after opening the app, or hit “Back up now”.</div>
     :<div style={{border:`1px solid ${BD}`,borderRadius:8,overflow:"hidden"}}>
       {snaps.map((e,i)=>{const s=e.summary||{};return <div key={e.ts||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",padding:"11px 14px",borderBottom:i===snaps.length-1?"none":`1px solid ${BD}`,background:i===0?PARCH:WHITE}}>
         <div style={{minWidth:0}}>
           <div style={{fontSize:13,fontWeight:700,color:INK}}>{fmtWhen(e.ts)} <span style={{fontSize:10.5,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>· {reasonLabel(e.reason)}</span></div>
           <div style={{fontSize:11.5,color:WG,marginTop:2}}>{s.clients||0} clients · {s.jobs||0} jobs · {s.quotes||0} quotes · {s.invoices||0} invoices · {s.payments||0} payments</div>
         </div>
         <Btn sm ghost onClick={()=>doRestore(e)} disabled={busy}>Restore</Btn>
       </div>;})}
     </div>}
  </Card>;
}

// ── Appointments ───────────────────────────────────────────────────────────
const apptName=(a,clients)=>{const c=a.clientId&&clients.find(x=>x.id===a.clientId);return c?c.name:(a.clientName||"—");};
// Build a Google Calendar "add event" link from an appointment — no API/login needed.
const _apptCalTitle=(a,clients)=>{const n=apptName(a,clients);return `${a.type||"Appointment"}${n&&n!=="—"?" — "+n:""}`;};
const googleCalUrl=(a,clients)=>{
  const enc=encodeURIComponent;
  const pad=n=>String(n).padStart(2,"0");
  let dates;
  if(a.time){
    const s=new Date(`${a.date}T${a.time}:00`);const e=new Date(s.getTime()+3600000);
    const f=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    dates=`${f(s)}/${f(e)}`;
  }else{
    const d0=(a.date||"").replace(/-/g,"");const nd=new Date(`${a.date}T00:00:00`);nd.setDate(nd.getDate()+1);
    dates=`${d0}/${nd.getFullYear()}${pad(nd.getMonth()+1)}${pad(nd.getDate())}`;
  }
  const tz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"";}catch(e){return "";}})();
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(_apptCalTitle(a,clients))}&dates=${dates}${a.notes?`&details=${enc(a.notes)}`:""}${tz?`&ctz=${enc(tz)}`:""}`;
};
// Build one VEVENT for an appointment (used by the single-appointment .ics download AND the feed).
const _icsEsc=s=>String(s==null?"":s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
const _p2=n=>String(n).padStart(2,"0");
const apptVEvent=(a,clients)=>{
  let dtStart,dtEnd;
  if(a.time){
    const s=new Date(`${a.date}T${a.time}:00`),e=new Date(s.getTime()+3600000);
    const f=d=>`${d.getFullYear()}${_p2(d.getMonth()+1)}${_p2(d.getDate())}T${_p2(d.getHours())}${_p2(d.getMinutes())}00`;
    dtStart=`DTSTART:${f(s)}`;dtEnd=`DTEND:${f(e)}`;
  }else{
    const d0=(a.date||"").replace(/-/g,"");const nd=new Date(`${a.date}T00:00:00`);nd.setDate(nd.getDate()+1);
    dtStart=`DTSTART;VALUE=DATE:${d0}`;dtEnd=`DTEND;VALUE=DATE:${nd.getFullYear()}${_p2(nd.getMonth()+1)}${_p2(nd.getDate())}`;
  }
  return ["BEGIN:VEVENT",`UID:${a.id||uid()}@workshoppilot.app`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"")}`,dtStart,dtEnd,`SUMMARY:${_icsEsc(_apptCalTitle(a,clients))}`,...(a.notes?[`DESCRIPTION:${_icsEsc(a.notes)}`]:[]),"END:VEVENT"].join("\r\n");
};
const apptIcs=(a,clients)=>["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Workshop Pilot//Appointments//EN","CALSCALE:GREGORIAN",apptVEvent(a,clients),"END:VCALENDAR"].join("\r\n");
const downloadIcs=(filename,ics)=>{const url=URL.createObjectURL(new Blob([ics],{type:"text/calendar;charset=utf-8"}));const el=document.createElement("a");el.href=url;el.download=filename;document.body.appendChild(el);el.click();el.remove();URL.revokeObjectURL(url);};
function MiniBtn({label,color,onClick,filled}){
  return <button onClick={e=>{e.stopPropagation();onClick();}} style={{background:filled?color:color+"14",border:`1px solid ${filled?color:color+"44"}`,borderRadius:3,padding:"3px 10px",fontSize:11,fontWeight:700,color:filled?WHITE:color,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>;
}
function ApptLegend(){
  return <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
    {APPT_TYPES.map(t=><span key={t} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:WG,fontWeight:600}}><span style={{width:9,height:9,borderRadius:"50%",background:APPT_COLORS[t]}}/>{t}</span>)}
  </div>;
}

function AppointmentForm({clients,jobs=[],initial={},onSave,onCancel}){
  const[f,setF]=useState({clientId:"",clientName:"",jobId:"",type:APPT_TYPES[0],date:localToday(),time:"10:00",durationMin:"",status:"Scheduled",notes:"",...initial});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const setClient=v=>setF(p=>({...p,clientId:v,jobId:""}));   // reset related job when client changes
  const clientJobs=jobs.filter(j=>j.clientId===f.clientId);
  const end=addMin(f.time,f.durationMin);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
      <Input label="Date" value={f.date} onChange={set("date")} type="date"/>
      <Input label="Time" value={f.time} onChange={set("time")} type="time"/>
      <Input label="Length" value={f.durationMin} onChange={set("durationMin")} as="select" options={DURATION_OPTS}/>
    </div>
    {end&&<div style={{fontSize:11,color:WG,marginTop:-8,marginBottom:12}}>Ends about {fmtTime(end)}</div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label="Appointment type" value={f.type} onChange={set("type")} as="select" options={APPT_TYPES}/>
      <Input label="Status" value={f.status} onChange={set("status")} as="select" options={APPT_STATUSES}/>
    </div>
    <Input label="Existing client" value={f.clientId} onChange={setClient} as="select" options={[{value:"",label:"— New enquiry / not a client yet —"},...clients.map(c=>({value:c.id,label:c.name}))]}/>
    {!f.clientId&&<Input label="Name" value={f.clientName} onChange={set("clientName")} placeholder="Who is the appointment with?"/>}
    {f.clientId&&clientJobs.length>0&&<Input label="Related job (optional)" value={f.jobId} onChange={set("jobId")} as="select" options={[{value:"",label:"— Not tied to a job —"},...clientJobs.map(j=>({value:j.id,label:`${j.type} · ${j.stage}`}))]}/>}
    <Input label="Notes / purpose" value={f.notes} onChange={set("notes")} as="textarea" rows={3} placeholder="What's the appointment about? (ring details, budget, etc.)"/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn ghost onClick={onCancel}>Cancel</Btn>
      <Btn onClick={()=>{if(!f.date)return alert("Pick a date");if(!f.clientId&&!f.clientName.trim())return alert("Select a client or enter a name");onSave(f);}}>Save appointment</Btn>
    </div>
  </div>;
}

// Small clickable chip used in week + month calendar cells
function ApptChip({a,clients,onClick}){
  const col=APPT_COLORS[a.type]||GOLD;
  const cancelled=a.status==="Cancelled",dim=cancelled||a.status==="No-show",done=a.status==="Completed";
  const range=a.durationMin?`${fmtTime(a.time)}–${fmtTime(addMin(a.time,a.durationMin))}`:fmtTime(a.time);
  return <div onClick={e=>{e.stopPropagation();onClick();}} title={`${range||"(no time)"} · ${a.type} · ${apptName(a,clients)}${a.status&&a.status!=="Scheduled"?` · ${a.status}`:""}`}
    style={{background:col+(dim?"0D":"1A"),borderLeft:`3px solid ${dim?WG:col}`,borderRadius:6,padding:"3px 6px",fontSize:11,lineHeight:1.3,cursor:"pointer",marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:dim?0.6:1,textDecoration:cancelled?"line-through":"none"}}>
    {a.time&&<b style={{color:dim?WG:col}}>{fmtTime(a.time)}</b>} <span style={{color:INK}}>{apptName(a,clients)}</span>{done&&<span style={{color:OK,fontWeight:700}}> ✓</span>}
  </div>;
}

function Appointments({appointments,setAppointments,clients,setClients,jobs=[],setJobs,setView,setSelClient,setSelJob}){
  const[modal,setModal]=useState(null);     // "add" | {prefillDate} | appointment(edit)
  const[mode,setMode]=useState("list");     // list | week | month
  const[anchor,setAnchor]=useState(localToday());
  const[showPast,setShowPast]=useState(false);

  const save=(form,id)=>{
    if(!guardEdit())return;
    // Double-booking guard: warn if another live appointment shares the same date + time
    const clash=appointments.find(a=>a.id!==id&&a.date===form.date&&a.time&&a.time===form.time&&isLiveAppt(a)&&isLiveAppt(form));
    if(clash&&!confirm(`Heads up — you already have ${apptName(clash,clients)} (${clash.type}) booked at ${fmtTime(form.time)} on ${fmtDayShort(form.date)}. Book anyway?`))return;
    setAppointments(p=>{const n=id?p.map(a=>a.id===id?{...a,...form}:a):[...p,{...form,id:uid(),createdAt:today()}];persist(K.ap,n);return n;});
    setModal(null);
  };
  const del=id=>{if(!confirm("Delete this appointment?"))return;setAppointments(p=>{const n=p.filter(a=>a.id!==id);persist(K.ap,n);return n;});setModal(null);};
  const setStatus=(id,status)=>{setAppointments(p=>{const n=p.map(a=>a.id===id?{...a,status}:a);persist(K.ap,n);return n;});};
  const convertToClient=a=>{
    const name=(a.clientName||"").trim();if(!name)return;
    if(!confirm(`Create a client record for "${name}" and link this appointment to it?`))return;
    const nc={id:uid(),name,email:"",phone:"",street:"",city:"",state:"",postcode:"",notes:`Added from ${a.type} appointment on ${fmtDate(a.date)}.`,createdAt:today()};
    setClients(p=>{const n=[...p,nc];persist(K.cl,n);return n;});
    setAppointments(p=>{const n=p.map(x=>x.id===a.id?{...x,clientId:nc.id,clientName:""}:x);persist(K.ap,n);return n;});
  };
  // Open a job and scroll to its repair-intake card
  const goToIntake=jobId=>{setSelJob&&setSelJob(jobId);setView("jobDetail");setTimeout(()=>{const el=document.getElementById("repair-intake");if(el)el.scrollIntoView({behavior:"smooth",block:"start"});},120);};
  // For a Repair appointment with no job yet: create the client (if needed) + a Repair job, link, and open intake
  const startRepairIntake=a=>{
    let clientId=a.clientId,newClient=null;
    if(!clientId){
      const name=(a.clientName||"").trim();if(!name)return alert("Add a client or name to this appointment first.");
      if(!confirm(`This will create a client and a Repair job for "${name}", then open the intake form. Continue?`))return;
      newClient={id:uid(),name,email:"",phone:"",street:"",city:"",state:"",postcode:"",notes:`Added from ${a.type} appointment on ${fmtDate(a.date)}.`,createdAt:today()};
      clientId=newClient.id;
    }else if(!confirm("Create a Repair job for this client and open the intake form?"))return;
    const job={id:uid(),clientId,type:"Repair",stage:"Enquiry",description:a.notes||"",deadline:"",dateIn:a.date||today(),dateOut:"",notes:"",supplier:"",supplierRef:"",totalOverride:"",createdAt:today()};
    if(newClient)setClients(p=>{const n=[...p,newClient];persist(K.cl,n);return n;});
    if(setJobs)setJobs(p=>{const n=[...p,job];persist(K.jo,n);return n;});
    setAppointments(p=>{const n=p.map(x=>x.id===a.id?{...x,clientId,clientName:newClient?"":x.clientName,jobId:job.id}:x);persist(K.ap,n);return n;});
    goToIntake(job.id);
  };

  const byDay=useMemo(()=>{const m={};appointments.forEach(a=>{(m[a.date]=m[a.date]||[]).push(a);});Object.values(m).forEach(arr=>arr.sort((x,y)=>String(x.time||"").localeCompare(String(y.time||""))));return m;},[appointments]);
  const sorted=useMemo(()=>[...appointments].sort((a,b)=>String(a.date+(a.time||"")).localeCompare(String(b.date+(b.time||"")))),[appointments]);
  const tISO=localToday();

  const isEdit=modal&&modal.id;
  const modalInitial=modal==="add"?{}:(modal&&modal.prefillDate?{date:modal.prefillDate}:(isEdit?modal:{}));

  // ── Toolbar ──
  const pill=(val,label)=><button key={val} onClick={()=>setMode(val)} style={{padding:"6px 15px",borderRadius:3,border:`1px solid ${mode===val?GOLD:BD}`,background:mode===val?GOLD:"transparent",color:mode===val?WHITE:WG,fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>{label}</button>;
  const navBtn=(label,onClick)=><button onClick={onClick} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:4,padding:"6px 12px",fontSize:13,fontWeight:700,color:INK,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>;

  const renderList=()=>{
    const upcoming=sorted.filter(a=>isLiveAppt(a)&&a.date>=tISO);
    const past=sorted.filter(a=>!(isLiveAppt(a)&&a.date>=tISO)).reverse();
    const list=showPast?past:upcoming;
    const days=[...new Set(list.map(a=>a.date))];
    return <div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        <button onClick={()=>setShowPast(false)} style={{padding:"6px 15px",borderRadius:3,border:`1px solid ${!showPast?GOLD:BD}`,background:!showPast?GOLD:"transparent",color:!showPast?WHITE:WG,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>Upcoming ({upcoming.length})</button>
        <button onClick={()=>setShowPast(true)} style={{padding:"6px 15px",borderRadius:3,border:`1px solid ${showPast?GOLD:BD}`,background:showPast?GOLD:"transparent",color:showPast?WHITE:WG,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>Past &amp; resolved ({past.length})</button>
      </div>
      {list.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"14px 0"}}>No {showPast?"past or resolved":"upcoming"} appointments.</div></Card>}
      {days.map(d=>(
        <Card key={d}>
          <div style={{...SS.lbl,marginBottom:10,color:d===tISO?GOLD:WG}}>{d===tISO?"Today · ":""}{fmtDayShort(d)}</div>
          {byDay[d].filter(a=>list.includes(a)).map(a=>{
            const col=APPT_COLORS[a.type]||GOLD;
            const c=a.clientId&&clients.find(x=>x.id===a.clientId);
            const job=a.jobId&&jobs.find(j=>j.id===a.jobId);
            const cancelled=a.status==="Cancelled";
            return <div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"12px 0",borderBottom:`1px solid ${BD}`,opacity:cancelled?0.6:1}}>
              <div style={{width:78,flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:INK,textDecoration:cancelled?"line-through":"none"}}>{fmtTime(a.time)||"—"}</div>
                {a.durationMin?<div style={{fontSize:11,color:WG,marginTop:1}}>to {fmtTime(addMin(a.time,a.durationMin))}</div>:null}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <Badge label={a.type} color={col}/>
                  <span onClick={c?()=>{setSelClient(a.clientId);setView("clientDetail");}:undefined} style={{fontWeight:700,fontSize:14,color:INK,cursor:c?"pointer":"default",textDecoration:c?"underline":"none",textDecorationColor:BD}}>{apptName(a,clients)}</span>
                  {!c&&a.clientName&&<span style={{fontSize:11,color:WG,fontStyle:"italic"}}>new enquiry</span>}
                  {a.status&&a.status!=="Scheduled"&&<Badge label={a.status} color={APPT_STATUS_COLORS[a.status]||WG}/>}
                </div>
                {job&&<div onClick={()=>{setSelJob&&setSelJob(a.jobId);setView("jobDetail");}} style={{fontSize:12,color:GOLD,marginTop:4,cursor:"pointer",fontWeight:600}}>↳ {job.type} · {job.stage}</div>}
                {a.notes&&<div style={{fontSize:13,color:WG,marginTop:4,lineHeight:1.5}}>{a.notes}</div>}
                <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                  {isLiveAppt(a)&&<>
                    <MiniBtn label="📅 Add to Google Calendar" color={GOLD_D} filled onClick={()=>window.open(googleCalUrl(a,clients),"_blank","noopener")}/>
                    <MiniBtn label="⤓ Add to Apple / Outlook Calendar" color={WG} onClick={()=>downloadIcs(`appointment-${(a.id||"").slice(0,8)}.ics`,apptIcs(a,clients))}/>
                    <MiniBtn label="✓ Done" color={OK} onClick={()=>{if(confirm("Mark this appointment as done?"))setStatus(a.id,"Completed");}}/>
                    <MiniBtn label="No-show" color={DANGER} onClick={()=>{if(confirm("Mark this appointment as a no-show?"))setStatus(a.id,"No-show");}}/>
                    <MiniBtn label="Cancel" color={WARN} onClick={()=>{if(confirm("Cancel this appointment?"))setStatus(a.id,"Cancelled");}}/>
                  </>}
                  {!isLiveAppt(a)&&<MiniBtn label="↺ Reschedule" color={WG} onClick={()=>setStatus(a.id,"Scheduled")}/>}
                  {!a.clientId&&a.clientName&&<MiniBtn label="+ Create client" color={GOLD} onClick={()=>convertToClient(a)}/>}
                  {job&&job.type==="Repair"&&<MiniBtn label="🛠 Repair intake" color={APPT_COLORS["Repair"]} onClick={()=>goToIntake(a.jobId)}/>}
                  {a.type==="Jewellery Repair"&&!a.jobId&&<MiniBtn label="🛠 Start repair intake" color={APPT_COLORS["Jewellery Repair"]} onClick={()=>startRepairIntake(a)}/>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <Btn sm ghost onClick={()=>setModal(a)}>Edit</Btn>
                <Btn sm danger onClick={()=>del(a.id)}>×</Btn>
              </div>
            </div>;
          })}
        </Card>
      ))}
    </div>;
  };

  const renderWeek=()=>{
    const ws=startOfWeek(anchor);
    const days=Array.from({length:7},(_,i)=>addDays(ws,i));
    return <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        {navBtn("‹",()=>setAnchor(addDays(anchor,-7)))}
        {navBtn("Today",()=>setAnchor(localToday()))}
        {navBtn("›",()=>setAnchor(addDays(anchor,7)))}
        <div style={{fontSize:15,fontWeight:800,color:INK,marginLeft:6}}>{fmtDayShort(ws)} – {fmtDayShort(days[6])}</div>
      </div>
      <ApptLegend/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,alignItems:"start"}}>
        {days.map(d=>{
          const isT=d===tISO;const list=byDay[d]||[];
          return <div key={d} onClick={()=>setModal({prefillDate:d})} style={{background:WHITE,border:`1px solid ${isT?GOLD:BD_SOFT}`,borderRadius:5,minHeight:160,padding:"10px 9px",cursor:"pointer"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em",color:isT?GOLD:WG,marginBottom:8}}>{parseISO(d).toLocaleDateString(LOCALE,{weekday:"short"})} {parseISO(d).getDate()}</div>
            {list.map(a=><ApptChip key={a.id} a={a} clients={clients} onClick={()=>setModal(a)}/>)}
          </div>;
        })}
      </div>
      <div style={{fontSize:12,color:WG,marginTop:12}}>Tip: click any day to add an appointment.</div>
    </div>;
  };

  const renderMonth=()=>{
    const first=anchor.slice(0,8)+"01";
    const gridStart=startOfWeek(first);
    const cells=Array.from({length:42},(_,i)=>addDays(gridStart,i));
    const curMonth=first.slice(0,7);
    const dow=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    return <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        {navBtn("‹",()=>setAnchor(addMonths(anchor,-1)))}
        {navBtn("Today",()=>setAnchor(localToday()))}
        {navBtn("›",()=>setAnchor(addMonths(anchor,1)))}
        <div style={{fontSize:15,fontWeight:800,color:INK,marginLeft:6}}>{monthLabel(first)}</div>
      </div>
      <ApptLegend/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:BD,border:`1px solid ${BD}`,borderRadius:5,overflow:"hidden"}}>
        {dow.map(d=><div key={d} style={{background:PARCH,padding:"7px 0",textAlign:"center",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:WG}}>{d}</div>)}
        {cells.map(d=>{
          const isT=d===tISO;const inMonth=d.slice(0,7)===curMonth;const list=byDay[d]||[];
          return <div key={d} onClick={()=>setModal({prefillDate:d})} style={{background:WHITE,minHeight:104,padding:"5px 6px",cursor:"pointer",opacity:inMonth?1:0.4}}>
            <div style={{fontSize:12,fontWeight:isT?800:600,color:isT?GOLD:INK,textAlign:"right",marginBottom:3}}>{isT?<span style={{background:GOLD,color:WHITE,borderRadius:"50%",width:20,height:20,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11}}>{parseISO(d).getDate()}</span>:parseISO(d).getDate()}</div>
            {list.slice(0,3).map(a=><ApptChip key={a.id} a={a} clients={clients} onClick={()=>setModal(a)}/>)}
            {list.length>3&&<div onClick={e=>{e.stopPropagation();setAnchor(d);setMode("week");}} style={{fontSize:10,fontWeight:700,color:GOLD,cursor:"pointer",paddingLeft:2}}>+{list.length-3} more</div>}
          </div>;
        })}
      </div>
    </div>;
  };

  return <div>
    <SectionHeader eyebrow="Calendar" title="Appointments" subtitle="Your bookings — consultations, fittings, repairs and pickups." action={<Btn onClick={()=>setModal("add")}>+ New appointment</Btn>}/>
    <div style={{display:"flex",alignItems:"flex-start",gap:10,background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12.5,color:GOLD_D,lineHeight:1.5}}>
      <span style={{fontSize:15,lineHeight:1}}>💡</span>
      <span>A subscribed calendar — <strong>especially Google</strong> — can take a day or more to show a new booking (it refreshes on Google's schedule, nothing we can speed up). For one to appear <strong>right away</strong>, open the appointment and tap <strong>📅 Add to Google Calendar</strong> (or the Apple / Outlook option). Set up the one-time subscription in <span onClick={()=>setView("settings")} style={{textDecoration:"underline",cursor:"pointer",fontWeight:700}}>Settings</span> for hands-off syncing after that.</span>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:18}}>{pill("list","List")}{pill("week","Week")}{pill("month","Month")}</div>
    {mode==="list"?renderList():mode==="week"?renderWeek():renderMonth()}
    {modal&&<Modal title={isEdit?"Edit appointment":"New appointment"} onClose={()=>setModal(null)}>
      <AppointmentForm clients={clients} jobs={jobs} initial={modalInitial} onSave={f=>save(f,isEdit?modal.id:null)} onCancel={()=>setModal(null)}/>
    </Modal>}
  </div>;
}

// ── Nav + App shell ───────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",label:"Dashboard"},
  {id:"todo",label:"To-do"},
  {id:"appointments",label:"Appointments"},
  {id:"clients",label:"Clients"},
  {id:"jobs",label:"Jobs"},
  {id:"quotes",label:"Quotes"},
  {id:"invoices",label:"Invoices"},
  {id:"statements",label:"Statements"},
  {id:"gemcustody",label:"Safekeeping"},
  {id:"stock",label:"Stock"},
  {id:"pricing",label:"Pricing DB"},
  {id:"reports",label:"Reports"},
  {id:"settings",label:"Settings"},
];
const NAV_MAP=Object.fromEntries(NAV.map(n=>[n.id,n]));
const NAV_GROUPS=[
  {label:null,ids:["dashboard","todo"]},
  {label:"Workflow",ids:["appointments","clients","jobs","quotes","invoices","gemcustody"]},
  {label:"Trade",ids:["statements"]},
  {label:"Studio",ids:["stock","pricing","reports","settings"]},
];
// Cohesive line-icon set for the sidebar (single 24-grid, 1.6 stroke, inherits color).
function NavIcon({name,size=17}){
  const p={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.6,strokeLinecap:"round",strokeLinejoin:"round",style:{display:"block",flexShrink:0}};
  switch(name){
    case "dashboard": return <svg {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/></svg>;
    case "todo": return <svg {...p}><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 9l1.6 1.6L12.5 7.5"/><line x1="14.5" y1="9" x2="17" y2="9"/><path d="M8 15l1.6 1.6L12.5 13.5"/><line x1="14.5" y1="15" x2="17" y2="15"/></svg>;
    case "appointments": return <svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/></svg>;
    case "clients": return <svg {...p}><circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-3.2 2.3-5.5 5.5-5.5s5.5 2.3 5.5 5.5"/><path d="M16 5.4a3 3 0 0 1 0 5.2"/><path d="M16.6 13.6c2.5.2 4.4 2.4 4.4 5.4"/></svg>;
    case "jobs": return <svg {...p}><path d="M6 4H18L21 9L12 20L3 9Z"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="12" y2="20"/><line x1="15" y1="9" x2="12" y2="20"/><line x1="9" y1="9" x2="6" y2="4"/><line x1="15" y1="9" x2="18" y2="4"/></svg>;
    case "quotes": return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8.5" y1="8" x2="15.5" y2="8"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="16" x2="13" y2="16"/></svg>;
    case "invoices": return <svg {...p}><path d="M6 2.5H18V21.5L15 19.7L12 21.5L9 19.7L6 21.5Z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>;
    case "statements": return <svg {...p}><rect x="3.5" y="4" width="17" height="16" rx="2"/><line x1="3.5" y1="8.5" x2="20.5" y2="8.5"/><line x1="7" y1="12.5" x2="14" y2="12.5"/><line x1="7" y1="16" x2="11" y2="16"/><line x1="17" y1="12.5" x2="17" y2="16"/></svg>;
    case "gemcustody": return <svg {...p}><path d="M6 3h12l3 5-9 13L3 8Z"/><path d="M3 8h18"/><path d="M9 3 7.5 8 12 21"/><path d="M15 3l1.5 5L12 21"/></svg>;
    case "pricing": return <svg {...p}><path d="M20.6 11.4 12.6 3.4a2 2 0 0 0-1.4-.6H4.5a1 1 0 0 0-1 1v6.7a2 2 0 0 0 .6 1.4l8 8a1.9 1.9 0 0 0 2.7 0l5.8-5.8a1.9 1.9 0 0 0 0-2.7Z"/><circle cx="7.8" cy="7.8" r="1.4"/></svg>;
    case "reports": return <svg {...p}><line x1="3.5" y1="20.5" x2="20.5" y2="20.5"/><rect x="5" y="12" width="3.4" height="7" rx="0.6"/><rect x="10.3" y="8" width="3.4" height="11" rx="0.6"/><rect x="15.6" y="4.5" width="3.4" height="14.5" rx="0.6"/></svg>;
    case "stock": return <svg {...p}><path d="M12 2.8 21 7.4v9.2L12 21.2 3 16.6V7.4Z"/><path d="M3 7.4 12 12l9-4.6"/><line x1="12" y1="12" x2="12" y2="21.2"/><path d="M7.5 5.1 16.5 9.7"/></svg>;
    case "settings": return <svg {...p}><line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2.3"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.3"/></svg>;
    default: return null;
  }
}

// ── Login screen ──────────────────────────────────────────────────────────
// ── Signup abuse controls (basic, client-side) ─────────────────────────────
// These raise the bar against casual/scripted signup abuse and junk accounts through the UI. They are
// bypassable by anyone hitting the Supabase auth endpoint directly, so the real backstop is Supabase's
// built-in auth rate-limiting (on by default) + CAPTCHA enabled in the Auth dashboard. Kept deliberately
// lightweight so legit jewellers are never blocked.
const _EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Common throwaway / temp-mail domains — reject so signups use a real, reachable inbox.
const DISPOSABLE_EMAIL_DOMAINS=new Set(["mailinator.com","guerrillamail.com","guerrillamailblock.com","sharklasers.com","10minutemail.com","10minutemail.net","tempmail.com","temp-mail.org","throwawaymail.com","yopmail.com","getnada.com","nada.email","trashmail.com","maildrop.cc","dispostable.com","fakeinbox.com","mintemail.com","mohmal.com","emailondeck.com","spamgourmet.com","mailcatch.com","tempinbox.com","moakt.com","tempr.email","discard.email","mailnesia.com","33mail.com","spam4.me","mytemp.email","fakemail.net"]);
const _SIGNUP_MAX_PER_HOUR=5;          // per-browser cap on signup attempts in a rolling hour
const _SIGNUP_MIN_GAP_MS=8000;         // minimum spacing between attempts (stops rapid-fire)
const _SIGNUP_ATTEMPTS_KEY="ps_signup_attempts";
const _signupAttempts=()=>{try{const now=Date.now();return JSON.parse(localStorage.getItem(_SIGNUP_ATTEMPTS_KEY)||"[]").filter(t=>now-t<3600000);}catch(e){return [];}};
// Returns a user-facing message if the attempt should be blocked, else null.
const signupRateCheck=()=>{
  const arr=_signupAttempts(),now=Date.now();
  if(arr.length>=_SIGNUP_MAX_PER_HOUR)return "Too many sign-up attempts from this device. Please try again later.";
  if(arr.length&&now-arr[arr.length-1]<_SIGNUP_MIN_GAP_MS)return "Please wait a few seconds before trying again.";
  return null;
};
const recordSignupAttempt=()=>{try{const arr=_signupAttempts();arr.push(Date.now());localStorage.setItem(_SIGNUP_ATTEMPTS_KEY,JSON.stringify(arr));}catch(e){}};

// ── CAPTCHA (Cloudflare Turnstile) ─────────────────────────────────────────
// Only active where a site key is configured (VITE_TURNSTILE_SITE_KEY) — so the owner's own
// single-tenant deployment and local dev, which don't set it, are unaffected. When active it's
// required for BOTH sign-up and sign-in, because enabling CAPTCHA in the Supabase Auth dashboard
// enforces a token on both endpoints. Pair the site key here with the matching secret key in
// Supabase → Authentication → Settings → Enable Captcha protection (provider: Turnstile).
const TURNSTILE_SITE_KEY=import.meta.env.VITE_TURNSTILE_SITE_KEY||"";
let _turnstilePromise=null;
const loadTurnstile=()=>{
  if(typeof window==="undefined")return Promise.reject(new Error("no window"));
  if(window.turnstile)return Promise.resolve();
  if(_turnstilePromise)return _turnstilePromise;
  _turnstilePromise=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async=true;s.defer=true;
    s.onload=()=>resolve();
    s.onerror=()=>{_turnstilePromise=null;reject(new Error("turnstile load failed"));};
    document.head.appendChild(s);
  });
  return _turnstilePromise;
};

function Login(){
  // "in" = sign in · "up" = create account. The landing's "Start free trial" links to ?signup so
  // new visitors open straight on the create-account view instead of the sign-in wall.
  const[mode,setMode]=useState(()=>{
    try{if(typeof window!=="undefined"){const p=new URLSearchParams(window.location.search);if(p.has("signup")||p.has("invite"))return "up";}}catch(e){}
    return "in";
  });
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[studioName,setStudioName]=useState("");
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState("");
  const[sentTo,setSentTo]=useState("");   // set after a successful sign-up → "check your email" state
  const[hp,setHp]=useState("");           // honeypot: hidden from humans, bots fill it → we silently no-op
  const captchaOn=!!TURNSTILE_SITE_KEY;   // CAPTCHA required only where a site key is configured (this deployment)
  const[captchaToken,setCaptchaToken]=useState("");
  const[captchaFailed,setCaptchaFailed]=useState(false);
  const captchaRef=useRef(null);
  const widgetIdRef=useRef(null);
  const resetCaptcha=()=>{if(!captchaOn)return;setCaptchaToken("");try{if(widgetIdRef.current!=null&&window.turnstile)window.turnstile.reset(widgetIdRef.current);}catch(e){}};
  // Load + render the Turnstile widget once (skipped on the "check your email" screen).
  useEffect(()=>{
    if(!captchaOn||sentTo)return;
    let cancelled=false;
    loadTurnstile().then(()=>{
      if(cancelled||!captchaRef.current||!window.turnstile||widgetIdRef.current!=null)return;
      try{
        widgetIdRef.current=window.turnstile.render(captchaRef.current,{
          sitekey:TURNSTILE_SITE_KEY,theme:"dark",size:"flexible",
          callback:(t)=>{setCaptchaToken(t);setCaptchaFailed(false);},
          "error-callback":()=>setCaptchaToken(""),
          "expired-callback":()=>setCaptchaToken(""),
        });
      }catch(e){setCaptchaFailed(true);}
    }).catch(()=>{if(!cancelled)setCaptchaFailed(true);});
    return()=>{cancelled=true;try{if(widgetIdRef.current!=null&&window.turnstile)window.turnstile.remove(widgetIdRef.current);}catch(e){}widgetIdRef.current=null;};
  },[captchaOn,sentTo]);
  // Public sign-up is opt-in per deployment (VITE_ALLOW_SIGNUP="true"). Off by default, so the
  // single-tenant business deployment keeps an admin-only login; the tester deployment turns it on.
  const allowSignup=import.meta.env.VITE_ALLOW_SIGNUP==="true";
  const signUp=allowSignup&&mode==="up";
  // Teammate invites: when the user arrived via …/?invite=<token> they're joining an existing
  // studio, not creating one — hide the studio-name field and reframe the copy.
  const invited=(()=>{try{return new URLSearchParams(window.location.search).has("invite")||!!localStorage.getItem("pendingInvite");}catch(e){return false;}})();
  const submit=async(e)=>{
    e&&e.preventDefault();
    if(!email.trim()||!password)return setErr("Enter your email and password.");
    if(signUp&&!invited&&!studioName.trim())return setErr("Enter your studio / business name.");
    if(signUp&&password.length<6)return setErr("Choose a password of at least 6 characters.");
    if(signUp){
      // Honeypot tripped → almost certainly a bot. Show the normal "check your email" state so it
      // moves on, but do nothing (no account created, attempt not even recorded).
      if(hp.trim()){setSentTo(email.trim());return;}
      const em=email.trim().toLowerCase();
      if(!_EMAIL_RE.test(em))return setErr("Enter a valid email address.");
      if(DISPOSABLE_EMAIL_DOMAINS.has(em.split("@")[1]||""))return setErr("Please sign up with a permanent email address, not a temporary one.");
      const blocked=signupRateCheck();
      if(blocked)return setErr(blocked);
    }
    // CAPTCHA gate (both sign-up and sign-in, when active) — Supabase enforces it server-side too.
    if(captchaOn&&!captchaToken)return setErr("Please complete the verification check below.");
    setBusy(true);setErr("");
    if(signUp){
      recordSignupAttempt();
      // Studio name rides in user_metadata so it survives the email-confirmation gap and
      // pre-fills the "create your studio" step on first sign-in.
      const{data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{studio_name:studioName.trim()},captchaToken:captchaToken||undefined}});
      setBusy(false);
      resetCaptcha();   // Turnstile tokens are single-use → refresh for any retry
      if(error)return setErr(error.message||"Sign up failed.");
      // Confirmation required → no active session yet; tell them to check their inbox.
      if(!data.session)setSentTo(email.trim());
    }else{
      const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password,options:{captchaToken:captchaToken||undefined}});
      setBusy(false);
      resetCaptcha();
      if(error)setErr(error.message||"Sign in failed.");
    }
  };
  const switchMode=to=>{setMode(to);setErr("");setSentTo("");resetCaptcha();};
  const darkInp={...SS.inp,marginTop:4,marginBottom:14,background:"#161616",border:"1px solid rgba(255,255,255,0.12)",color:WHITE};
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#000000",fontFamily:"'Poppins',sans-serif",padding:20}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:360,background:"#0E0E0E",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"36px 32px"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:22,fontWeight:700,color:WHITE,letterSpacing:"0.16em",textTransform:"uppercase",lineHeight:1}}>Workshop Pilot</div>
      </div>
      {sentTo
        ?<div style={{textAlign:"center"}}>
          <div style={{fontSize:30,marginBottom:12}}>📧</div>
          <div style={{fontSize:16,fontWeight:800,color:WHITE,marginBottom:8}}>Check your email</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.6,marginBottom:22}}>We sent a confirmation link to <strong style={{color:WHITE}}>{sentTo}</strong>. Click it, then sign in to {invited?"join the team":"set up your studio"}.</div>
          <button type="button" onClick={()=>switchMode("in")} style={{background:"none",border:"none",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Back to sign in</button>
        </div>
        :<>
          {signUp&&invited&&<div style={{background:"rgba(184,146,42,0.12)",border:`1px solid ${GOLD}55`,borderRadius:8,padding:"11px 13px",marginBottom:16,fontSize:12.5,color:"rgba(255,255,255,0.75)",lineHeight:1.5}}>You've been invited to join a studio. Create your account below to join the team.</div>}
          {signUp&&<input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e=>setHp(e.target.value)} style={{position:"absolute",left:"-9999px",width:1,height:1,opacity:0,pointerEvents:"none"}}/>}
          {signUp&&!invited&&<>
            <label style={{...SS.lbl,color:"rgba(255,255,255,0.5)"}}>Studio / business name</label>
            <input value={studioName} onChange={e=>setStudioName(e.target.value)} autoFocus placeholder="e.g. Aurora Fine Jewellery" style={darkInp}/>
          </>}
          <label style={{...SS.lbl,color:"rgba(255,255,255,0.5)"}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus={!signUp} placeholder="you@studio.com" style={darkInp}/>
          <label style={{...SS.lbl,color:"rgba(255,255,255,0.5)"}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={signUp?"At least 6 characters":"••••••••"} style={{...darkInp,marginBottom:18}}/>
          {captchaOn&&<div style={{marginBottom:14}}>
            <div ref={captchaRef}/>
            {captchaFailed&&<div style={{fontSize:11,color:"#FF9B91",marginTop:6,lineHeight:1.5}}>Couldn't load the verification check. Refresh the page and try again.</div>}
          </div>}
          {err&&<div style={{background:DANGER+"22",border:`1px solid ${DANGER}55`,color:"#FF9B91",fontSize:12,padding:"9px 12px",borderRadius:4,marginBottom:14}}>{err}</div>}
          <button type="submit" disabled={busy} style={{width:"100%",background:busy?"#7A5F0F":GOLD,color:WHITE,border:"none",borderRadius:4,padding:"11px",fontSize:14,fontWeight:700,cursor:busy?"default":"pointer",fontFamily:"inherit",letterSpacing:"0.04em"}}>
            {busy?(signUp?"Creating account…":"Signing in…"):(signUp?(invited?"Create account & join":"Create account"):"Sign in")}
          </button>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center",marginTop:16,lineHeight:1.6}}>
            {!allowSignup
              ?"Accounts are created by your studio administrator."
              :signUp
                ?<>Already have an account? <button type="button" onClick={()=>switchMode("in")} style={{background:"none",border:"none",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",padding:0}}>Sign in</button></>
                :<>New here? <button type="button" onClick={()=>switchMode("up")} style={{background:"none",border:"none",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",padding:0}}>Create a studio account</button></>}
          </div>
        </>}
    </form>
  </div>;
}

// First sign-in for a new account: create the studio (via the security-definer RPC that
// bootstraps studios + membership), then hand the id back so the app can drop straight in.
function StudioOnboarding({defaultName,onCreated}){
  const[name,setName]=useState(defaultName||"");
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState("");
  const create=async(e)=>{
    e&&e.preventDefault();
    if(!name.trim())return setErr("Enter your studio / business name.");
    setBusy(true);setErr("");
    const{data,error}=await supabase.rpc("create_studio_for_current_user",{studio_name:name.trim()});
    setBusy(false);
    if(error)return setErr(error.message||"Couldn't create your studio. Please try again.");
    onCreated(data);   // RPC returns the new studio id
  };
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CREAM,fontFamily:"'Poppins',sans-serif",padding:20}}>
    <form onSubmit={create} style={{width:"100%",maxWidth:420,background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 30px",boxShadow:SHADOW}}>
      <div style={{fontSize:30,marginBottom:12,textAlign:"center"}}>✨</div>
      <div style={{fontSize:18,fontWeight:800,color:INK,marginBottom:6,textAlign:"center"}}>Set up your studio</div>
      <div style={{fontSize:13,color:WG,lineHeight:1.6,marginBottom:20,textAlign:"center"}}>Name your studio to get started. You can change it (and add your logo &amp; details) anytime in Settings.</div>
      <Input label="Studio / business name" value={name} onChange={setName} placeholder="e.g. Aurora Fine Jewellery"/>
      {err&&<div style={{background:DANGER+"18",border:`1px solid ${DANGER}44`,color:DANGER,fontSize:12,padding:"9px 12px",borderRadius:4,margin:"12px 0"}}>{err}</div>}
      <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",marginTop:18}}>
        <button type="button" onClick={()=>supabase.auth.signOut()} style={{background:"none",border:"none",color:WG,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",padding:0}}>Sign out</button>
        <Btn onClick={create} disabled={busy}>{busy?"Creating…":"Create studio"}</Btn>
      </div>
    </form>
  </div>;
}

// A single task row — hover lifts the row and fades in the delete control.
function TaskRow({it,ch,doingIt,pr,accent,job,jobClient,onOpenJob,onToggleDone,onToggleDoing,onOpen,onRemove}){
  const[h,setH]=useState(false);
  const borderCol=ch?.overdue?DANGER+"55":doingIt?WARN+"55":BD;
  const chip={display:"inline-block",fontSize:11,fontWeight:700,borderRadius:5,padding:"3px 8px",letterSpacing:"0.02em",lineHeight:1.3};
  const sc=job?(SC[job.stage]||WG):WG;
  const hasChips=doingIt||ch||pr||job;
  const jumpJob=e=>{e.stopPropagation();onOpenJob&&onOpenJob();};
  const bc=h?GOLD:borderCol;   // solid gold on hover so the outline stays clearly visible
  return <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{display:"flex",alignItems:"flex-start",gap:11,background:h?WHITE:PARCH,border:`1px solid ${bc}`,borderLeft:accent?`3px solid ${DANGER}`:`1px solid ${bc}`,borderRadius:6,padding:"12px 13px",boxShadow:h?SHADOW:"none",transition:"background 0.14s,box-shadow 0.14s,border-color 0.14s"}}>
    <button onClick={onToggleDone} title={it.done?"Mark as not done":"Mark as done"} style={{flexShrink:0,marginTop:1,width:19,height:19,borderRadius:6,border:`2px solid ${it.done?OK:"#C9C9CD"}`,background:it.done?OK:WHITE,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{it.done&&<span style={{color:WHITE,fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}</button>
    {!it.done&&<button onClick={onToggleDoing} title={doingIt?"Mark as not in progress":"Mark as in progress"} style={{flexShrink:0,marginTop:1,width:19,height:19,borderRadius:"50%",border:`2px solid ${doingIt?WARN:"#C9C9CD"}`,background:doingIt?GOLD_L:WHITE,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{doingIt&&<span style={{width:8,height:8,borderRadius:"50%",background:WARN,display:"block"}}/>}</button>}
    <div onClick={onOpen} title="Open task details" style={{flex:1,minWidth:0,cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13.5,fontWeight:500,color:it.done?WG:INK,textDecoration:it.done?"line-through":"none",lineHeight:1.5,wordBreak:"break-word"}}>
        {it.text}
        {it.notes&&it.notes.trim()&&<span title="Has notes" style={{flexShrink:0,fontSize:11,opacity:0.55}}>📝</span>}
      </div>
      {hasChips&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:7}}>
        {job&&<span onClick={jumpJob} title={`Open ${job.type} job`} style={{...chip,color:sc,background:sc+"1A",border:`1px solid ${sc}55`,cursor:"pointer"}}>{job.stage}</span>}
        {pr&&<span style={{...chip,color:pr.color,background:pr.bg,border:`1px solid ${pr.color}33`}}>{pr.lbl}</span>}
        {doingIt&&<span style={{...chip,color:WARN,background:GOLD_L,border:`1px solid ${WARN}33`}}>In progress</span>}
        {ch&&<span style={{...chip,color:ch.color,background:ch.bg,border:`1px solid ${ch.color}33`}}>{ch.label}</span>}
      </div>}
      {job&&<div onClick={jumpJob} title="Open linked job" style={{fontSize:11.5,color:GOLD_D,fontWeight:600,marginTop:hasChips?6:3,cursor:"pointer",display:"flex",alignItems:"center",gap:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span style={{opacity:0.65}}>→</span>{job.type}{jobClient?` · ${jobClient}`:""}</div>}
      {it.notes&&it.notes.trim()&&<div style={{fontSize:11.5,color:WG,marginTop:(hasChips||job)?6:3,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.notes.trim()}</div>}
    </div>
    <button onClick={onRemove} title="Delete task" style={{flexShrink:0,alignSelf:"center",background:"none",border:"none",cursor:"pointer",color:WG,fontSize:17,lineHeight:1,padding:"0 2px",opacity:h?0.85:0.25,transition:"opacity 0.14s"}}>×</button>
  </div>;
}

// Searchable job picker — type to filter, pick from a short list, then collapses to a tidy summary.
function JobPicker({jobs,clients,value,onChange,onOpen}){
  const[q,setQ]=useState("");
  const[open,setOpen]=useState(false);
  const sel=value?jobs.find(j=>j.id===value):null;
  const badge=sc=>({fontSize:10.5,fontWeight:700,color:sc,background:sc+"1A",border:`1px solid ${sc}55`,borderRadius:5,padding:"2px 8px",whiteSpace:"nowrap",flexShrink:0});
  if(sel&&!open){
    const c=clients.find(x=>x.id===sel.clientId);const sc=SC[sel.stage]||WG;
    return <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,border:`1px solid ${BD}`,borderLeft:`4px solid ${sc}`,borderRadius:6,padding:"10px 12px",background:PARCH}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13.5,fontWeight:700,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel.type}</div>
          <div style={{fontSize:12,color:WG,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{clientDisplayName(c)||"—"}</div>
        </div>
        <span style={badge(sc)}>{sel.stage}</span>
      </div>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <Btn sm ghost onClick={()=>{setOpen(true);setQ("");}}>Change</Btn>
        <Btn sm ghost onClick={()=>onOpen&&onOpen(sel.id)}>Open →</Btn>
        <Btn sm ghost onClick={()=>{onChange("");setOpen(false);}}>Unlink</Btn>
      </div>
    </div>;
  }
  const ql=q.trim().toLowerCase();
  const list=[...jobs].sort((a,b)=>(jobIsDone(a)?1:0)-(jobIsDone(b)?1:0)).filter(j=>{
    if(!ql)return true;
    const c=clients.find(x=>x.id===j.clientId);
    return `${j.type} ${clientDisplayName(c)||""} ${j.stage} ${j.description||""}`.toLowerCase().includes(ql);
  }).slice(0,8);
  return <div style={{marginBottom:16}}>
    <input autoFocus={open} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search jobs by client or type…" style={{...SS.inp,marginTop:0}}/>
    <div style={{border:`1px solid ${BD}`,borderRadius:6,marginTop:6,maxHeight:224,overflowY:"auto"}}>
      {list.length===0
        ? <div style={{padding:"14px",fontSize:12.5,color:WG,textAlign:"center"}}>No matching jobs.</div>
        : list.map((j,i)=>{
            const c=clients.find(x=>x.id===j.clientId);const sc=SC[j.stage]||WG;
            return <div key={j.id} onClick={()=>{onChange(j.id);setOpen(false);setQ("");}}
              onMouseEnter={e=>e.currentTarget.style.background=PARCH} onMouseLeave={e=>e.currentTarget.style.background=WHITE}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer",background:WHITE,borderBottom:i<list.length-1?`1px solid ${BD_SOFT}`:"none"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:sc,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.type}</div>
                <div style={{fontSize:11.5,color:WG,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{clientDisplayName(c)||"—"}</div>
              </div>
              <span style={badge(sc)}>{j.stage}</span>
            </div>;
          })}
    </div>
    {jobs.length>8&&<div style={{fontSize:11,color:WG,marginTop:5}}>Showing first 8 — type to narrow the list.</div>}
    {sel&&<div style={{marginTop:8}}><Btn sm ghost onClick={()=>{setOpen(false);setQ("");}}>Cancel</Btn></div>}
  </div>;
}

// ── To-do board (per-person running checklists, shared across the studio) ──
function TodoBoard({todos,setTodos,jobs=[],clients=[],setView,setSelJob}){
  const isMobile=useIsMobile();
  const people=todos?.people||[];
  const items=todos?.items||[];
  const[newPerson,setNewPerson]=useState("");
  const[draft,setDraft]=useState({});
  const[editId,setEditId]=useState(null);   // task currently open in the detail editor
  const[editText,setEditText]=useState("");
  const[editNotes,setEditNotes]=useState("");
  const[editDue,setEditDue]=useState("");
  const[editStatus,setEditStatus]=useState("open");   // not started / in progress / done
  const[editPriority,setEditPriority]=useState("med"); // high / med (normal) / low
  const[editPerson,setEditPerson]=useState("");        // reassign a task to another person
  const[editJob,setEditJob]=useState("");              // optional link to a real job
  const[query,setQuery]=useState("");                  // free-text search across all lists
  const[statusFilter,setStatusFilter]=useState("all"); // all / open / doing / done / overdue
  const[showDone,setShowDone]=useState({});            // per-person: is the Completed section expanded
  const toggleShowDone=pid=>setShowDone(s=>({...s,[pid]:!s[pid]}));
  const save=next=>{if(!guardEdit())return;setTodos(next);persist(K.td,next);};
  const addPerson=()=>{const name=newPerson.trim();if(!name)return;save({people:[...people,{id:uid(),name}],items});setNewPerson("");};
  const removePerson=id=>{const p=people.find(x=>x.id===id);if(!confirm(`Remove ${p?.name||"this person"} and their whole list?`))return;save({people:people.filter(x=>x.id!==id),items:items.filter(i=>i.personId!==id)});};
  const setDraftFor=(pid,v)=>setDraft(d=>({...d,[pid]:v}));
  const addItem=pid=>{const t=(draft[pid]||"").trim();if(!t)return;save({people,items:[...items,{id:uid(),personId:pid,text:t,notes:"",due:"",done:false,status:"open",priority:"med",createdAt:new Date().toISOString()}]});setDraftFor(pid,"");};
  // Two independent controls: the square box marks done; the round dot flags in progress.
  const isDoing=i=>!i.done&&i.status==="doing";
  const toggleDone=id=>{const it=items.find(i=>i.id===id);if(it&&!it.done&&!confirm("Mark this task as complete?"))return;save({people,items:items.map(i=>i.id===id?{...i,done:!i.done,status:i.done?"open":"done"}:i)});};
  const toggleDoing=id=>save({people,items:items.map(i=>i.id!==id||i.done?i:{...i,status:i.status==="doing"?"open":"doing"})});
  const removeItem=id=>save({people,items:items.filter(i=>i.id!==id)});
  const clearDone=pid=>save({people,items:items.filter(i=>!(i.personId===pid&&i.done))});
  // Detail editor (title + longer notes + due date)
  const openEdit=it=>{setEditId(it.id);setEditText(it.text||"");setEditNotes(it.notes||"");setEditDue(it.due||"");setEditStatus(it.done?"done":it.status==="doing"?"doing":"open");setEditPriority(it.priority||"med");setEditPerson(it.personId);setEditJob(it.jobId||"");};
  const closeEdit=()=>setEditId(null);
  const saveEdit=()=>{const t=editText.trim();if(!t)return;save({people,items:items.map(i=>i.id===editId?{...i,text:t,notes:editNotes.trim(),due:editDue||"",done:editStatus==="done",status:editStatus,priority:editPriority,personId:editPerson||i.personId,jobId:editJob||""}:i)});setEditId(null);};
  const openJob=id=>{if(setSelJob&&setView){setSelJob(id);setView("jobDetail");}};
  const editingItem=items.find(i=>i.id===editId)||null;
  const editingPerson=editingItem?people.find(p=>p.id===editingItem.personId):null;

  // Due-date helpers — colour cues + urgency sort
  const tISO=localToday();
  const dueChip=due=>{
    if(!due)return null;
    const overdue=due<tISO,isToday=due===tISO,soon=!overdue&&!isToday&&due<=addDays(tISO,2);
    const compact=parseISO(due).toLocaleDateString(LOCALE,{day:"numeric",month:"short"});
    return{overdue,
      color:overdue?DANGER:(isToday||soon)?GOLD_D:WG,
      bg:overdue?"#FBEBE9":(isToday||soon)?GOLD_L:PARCH,
      label:overdue?`Overdue · ${compact}`:isToday?"Due today":due===addDays(tISO,1)?"Due tomorrow":`Due ${compact}`};
  };
  // Priority — high floats to the top of the open list; "med" is the neutral default.
  const prRank=i=>({high:0,med:1,low:2}[i.priority||"med"]);
  const prioTag=it=>it.priority==="high"?{lbl:"High priority",color:DANGER,bg:"#FBEBE9"}:it.priority==="low"?{lbl:"Low",color:WG,bg:PARCH}:null;
  // Open tasks sort: in-progress first, then by priority, then by soonest due date.
  const sortOpen=arr=>[...arr].sort((a,b)=>
    (isDoing(b)-isDoing(a))||
    (prRank(a)-prRank(b))||
    ((a.due||"9999-12-31").localeCompare(b.due||"9999-12-31")));

  // Search + status filter across everyone's lists
  const q=query.trim().toLowerCase();
  const filterActive=!!q||statusFilter!=="all";
  const matches=it=>{
    if(q&&!`${it.text||""} ${it.notes||""}`.toLowerCase().includes(q))return false;
    if(statusFilter==="open")return !it.done&&!isDoing(it);
    if(statusFilter==="doing")return isDoing(it);
    if(statusFilter==="done")return it.done;
    if(statusFilter==="overdue")return !it.done&&!!it.due&&it.due<tISO;
    return true;
  };

  const totalDoing=items.filter(isDoing).length;
  const totalTodo=items.filter(i=>!i.done&&!isDoing(i)).length;
  const totalDone=items.filter(i=>i.done).length;
  const totalHigh=items.filter(i=>!i.done&&i.priority==="high").length;

  // Single shared task-row renderer (used for both the open and completed lists)
  const renderRow=it=>{
    const ch=!it.done&&it.due?dueChip(it.due):null;
    const pr=!it.done?prioTag(it):null;
    const job=it.jobId?jobs.find(j=>j.id===it.jobId):null;
    const jobClient=job?clientDisplayName(clients.find(c=>c.id===job.clientId)):"";
    return <TaskRow key={it.id} it={it} ch={ch} doingIt={isDoing(it)} pr={pr} accent={!it.done&&it.priority==="high"}
      job={job} jobClient={jobClient} onOpenJob={job?()=>openJob(job.id):null}
      onToggleDone={()=>toggleDone(it.id)} onToggleDoing={()=>toggleDoing(it.id)} onOpen={()=>openEdit(it)} onRemove={()=>removeItem(it.id)}/>;
  };

  return <div>
    {/* Editorial header — matches the rest of the app */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:16,marginBottom:24}}>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:WG,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>Team tasks</div>
        <h1 style={{margin:0,fontSize:32,fontWeight:700,color:INK,letterSpacing:"-0.02em",fontFamily:"'Poppins',sans-serif"}}>To-do</h1>
        <div style={{color:INK,fontSize:15,marginTop:6,lineHeight:1.5}}>A running task list for each person — link a task to a job to see its live stage at a glance.</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",background:WHITE,border:`1px solid ${BD_SOFT}`,borderRadius:RADIUS,padding:"8px 10px",boxShadow:SHADOW}}>
        <input value={newPerson} onChange={e=>setNewPerson(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addPerson();}} placeholder="New person's name…" style={{...SS.inp,marginTop:0,width:isMobile?"auto":200,flex:isMobile?1:undefined,minWidth:0}}/>
        <Btn onClick={addPerson}>{isMobile?"Add":"+ Add person"}</Btn>
      </div>
    </div>

    {people.length===0
      ? <Card style={{marginTop:4}}><div style={{color:WG,fontSize:14,textAlign:"center",padding:"40px 0"}}>
          <div style={{fontSize:38,marginBottom:12}}>📝</div>
          <div style={{fontWeight:700,fontSize:16,color:INK,marginBottom:6}}>No lists yet</div>
          <div style={{maxWidth:360,margin:"0 auto",lineHeight:1.55}}>Type a name in the box above (e.g. “Eric”, “Sarah”) and press <strong style={{color:INK}}>+ Add person</strong> to start their to-do list.</div>
        </div></Card>
      : <>
          {/* Summary tiles */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(176px,1fr))",gap:14,marginBottom:18}}>
            <Stat label="People" value={people.length} tint="slate" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="m14.5 16.5l3.716 1.118a4.07 4.07 0 0 1 2.76 2.892c.136.536-.327.99-.882.99H3.906c-.555 0-1.018-.454-.882-.99a4.07 4.07 0 0 1 2.76-2.892L9.5 16.5v-1.938c-1.78-1.393-3-3.062-3-6.645c0-3.59 1.955-5.417 4.992-5.417c2.151 0 3.047 1 3.047 1c2.538 0 2.961 2.097 2.961 4.417c0 3.583-1.22 5.252-3 6.645z"/></svg>}/>
            <Stat label="To do" value={totalTodo} tint="slate" icon={<svg width="20" height="20" viewBox="0 0 297 297" fill="currentColor"><path d="M237.333,33h-50.14c-2.558-18.613-18.556-33-37.86-33s-35.303,14.387-37.86,33h-51.14C50.408,33,42,41.075,42,51v228c0,9.925,8.408,18,18.333,18h177c9.925,0,17.667-8.075,17.667-18V51C255,41.075,247.258,33,237.333,33z M93.052,48c3.432,18.033,19.084,31,38.092,31h36.379c19.008,0,34.66-12.967,38.092-31H223v216H75V48H93.052z M149.333,16c10.456,0,19.242,7.259,21.601,17h-43.201C130.091,23.259,138.877,16,149.333,16z"/><rect x="99" y="109" width="50" height="15"/><polygon points="200.689,105.076 189.645,94.924 175.427,110.39 169.237,105.347 159.763,116.976 176.907,130.944"/><rect x="99" y="157" width="50" height="15"/><polygon points="200.689,153.076 189.645,142.924 175.427,158.39 169.237,153.347 159.763,164.976 176.907,178.944"/><rect x="99" y="205" width="50" height="15"/><polygon points="200.689,201.076 189.645,190.924 175.427,206.39 169.237,201.347 159.763,212.976 176.907,226.944"/></svg>}/>
            <Stat label="In progress" value={totalDoing} tint="slate" icon={<svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor"><path d="M16,2A14,14,0,1,0,30,16,14.0158,14.0158,0,0,0,16,2Zm0,26A12,12,0,0,1,16,4V16l8.4812,8.4814A11.9625,11.9625,0,0,1,16,28Z"/></svg>}/>
            <Stat label="High priority" value={totalHigh} tint={totalHigh>0?"rose":"slate"} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5757 1.42426C11.81 1.18995 12.1899 1.18995 12.4243 1.42426L22.5757 11.5757C22.81 11.81 22.8101 12.1899 22.5757 12.4243L12.4243 22.5757C12.19 22.81 11.8101 22.8101 11.5757 22.5757L1.42426 12.4243C1.18995 12.19 1.18995 11.8101 1.42426 11.5757L11.5757 1.42426Z"/><path d="M12 8L12 12"/><path d="M12 16.01L12.01 15.9989"/></svg>}/>
            <Stat label="Completed" value={totalDone} tint="slate" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3.338A9.95 9.95 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10q-.002-1.03-.2-2"/><path d="M8 12.5s1.5 0 3.5 3.5c0 0 5.559-9.167 10.5-11"/></svg>}/>
          </div>

          {/* Search + status filter */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:22}}>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tasks…" style={{...SS.inp,marginTop:0,flex:"1 1 220px",maxWidth:340}}/>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["all","All"],["open","To do"],["doing","In progress"],["done","Done"],["overdue","Overdue"]].map(([v,l])=>{
                const on=statusFilter===v;
                const c=v==="overdue"?DANGER:GOLD,cl=v==="overdue"?"#FBEBE9":GOLD_L,cd=v==="overdue"?DANGER:GOLD_D;
                return <button key={v} onClick={()=>setStatusFilter(v)} style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:`1.5px solid ${on?c:BD}`,background:on?cl:WHITE,color:on?cd:WG}}>{l}</button>;
              })}
            </div>
            {filterActive&&<button onClick={()=>{setQuery("");setStatusFilter("all");}} style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:12.5,fontWeight:700,fontFamily:"inherit",textDecoration:"underline",padding:"4px 2px"}}>Clear</button>}
          </div>

          {/* Person cards — flex-wrap so cards grow to a comfortable width and fill each row evenly */}
          <div style={{display:"flex",flexWrap:"wrap",gap:20,alignItems:"flex-start"}}>
            {people.map(person=>{
              const list=items.filter(i=>i.personId===person.id);
              const fullOpen=list.filter(i=>!i.done);
              const fullDone=list.filter(i=>i.done);
              const fullDoing=fullOpen.filter(isDoing);
              const overdueCount=fullOpen.filter(i=>i.due&&i.due<tISO).length;
              const pct=list.length?Math.round(fullDone.length/list.length*100):0;
              // Visible rows honour the search + status filter; header stats stay true to the full list.
              const open=sortOpen(fullOpen.filter(matches));
              const done=fullDone.filter(matches);
              const doneCount=filterActive?done.length:fullDone.length;
              const showCompleted=(!!showDone[person.id]||statusFilter==="done"||!!q)&&done.length>0;
              // With a filter active, drop cards that have nothing matching.
              if(filterActive&&open.length===0&&done.length===0)return null;
              return <div key={person.id} style={{flex:isMobile?"1 1 100%":"1 1 360px",minWidth:0,maxWidth:isMobile?"100%":560,background:WHITE,border:`1px solid ${BD_SOFT}`,borderRadius:RADIUS,boxShadow:SHADOW,padding:isMobile?"16px 14px 18px":"22px 22px 24px",display:"flex",flexDirection:"column"}}>
                {/* Person header */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${BD_SOFT}`}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:GOLD_L,color:GOLD_D,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,flexShrink:0}}>{(person.name||"?").slice(0,1).toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:16,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{person.name}</div>
                    <div style={{fontSize:11,color:WG,marginTop:1}}>{fullOpen.length} open{fullDoing.length?<span style={{color:WARN,fontWeight:700}}> · {fullDoing.length} in progress</span>:""}{fullDone.length?` · ${fullDone.length} done`:""}{overdueCount>0&&<span style={{color:DANGER,fontWeight:700}}> · {overdueCount} overdue</span>}</div>
                  </div>
                  <button onClick={()=>removePerson(person.id)} title="Remove person" style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:18,lineHeight:1,padding:0,flexShrink:0}}>×</button>
                </div>

                {/* Progress bar */}
                {list.length>0&&<div style={{height:6,background:BD,borderRadius:3,overflow:"hidden",marginBottom:14}}>
                  <div style={{width:`${pct}%`,height:"100%",background:OK,transition:"width 0.25s"}}/>
                </div>}

                {/* Add task */}
                <div style={{display:"flex",gap:6,marginBottom:list.length?12:0}}>
                  <input value={draft[person.id]||""} onChange={e=>setDraftFor(person.id,e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addItem(person.id);}} placeholder="Add a task…" style={{...SS.inp,marginTop:0,flex:1,padding:"9px 12px",fontSize:13}}/>
                  <Btn sm onClick={()=>addItem(person.id)}>Add</Btn>
                </div>

                {/* Tasks */}
                {!filterActive&&list.length===0
                  ? <div style={{fontSize:12.5,color:WG,fontStyle:"italic",padding:"12px 0 4px",textAlign:"center"}}>No tasks yet — add one above.</div>
                  : <>
                      {open.length>0&&<div style={{display:"flex",flexDirection:"column",gap:9}}>{open.map(renderRow)}</div>}
                      {!filterActive&&fullOpen.length===0&&fullDone.length>0&&<div style={{fontSize:12.5,color:OK,fontWeight:600,padding:"10px 0 2px",textAlign:"center"}}>All caught up ✓</div>}
                      {doneCount>0&&<div style={{marginTop:open.length>0?12:8}}>
                        <button onClick={()=>toggleShowDone(person.id)} style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:11.5,fontWeight:700,fontFamily:"inherit",padding:"2px 0",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:9}}>{showCompleted?"▾":"▸"}</span>Completed ({doneCount})
                        </button>
                        {showCompleted&&<div style={{display:"flex",flexDirection:"column",gap:9,marginTop:8}}>
                          {done.map(renderRow)}
                          <button onClick={()=>clearDone(person.id)} style={{marginTop:4,alignSelf:"flex-start",background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 11px",fontSize:11,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>Clear {fullDone.length} completed</button>
                        </div>}
                      </div>}
                    </>}
              </div>;
            })}
          </div>
        </>}

    {/* Task detail editor */}
    {editingItem&&<Modal title="Task details" onClose={closeEdit}>
      <div style={{fontSize:11,fontWeight:700,color:WG,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>
        {editingPerson?.name||"Unassigned"}{editingItem.createdAt?` · added ${fmtDate(editingItem.createdAt.slice(0,10))}`:""}
      </div>
      <label style={{...SS.lbl,marginBottom:4}}>Task</label>
      <input value={editText} onChange={e=>setEditText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();}} placeholder="Task title" style={{...SS.inp,marginTop:0,marginBottom:16}}/>
      {people.length>1&&<>
        <label style={{...SS.lbl,marginBottom:4}}>Assigned to</label>
        <select value={editPerson} onChange={e=>setEditPerson(e.target.value)} style={{...SS.inp,marginTop:0,marginBottom:16}}>
          {people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </>}
      <label style={{...SS.lbl,marginBottom:4}}>Status</label>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["open","Not started",WG],["doing","In progress",WARN],["done","Done",OK]].map(([v,lbl,c])=>{
          const on=editStatus===v;
          return <button key={v} onClick={()=>setEditStatus(v)} style={{flex:1,padding:"8px 6px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",border:`1.5px solid ${on?c:BD}`,background:on?(v==="done"?OK_BG:v==="doing"?GOLD_L:PARCH):WHITE,color:on?c:WG}}>{lbl}</button>;
        })}
      </div>
      <label style={{...SS.lbl,marginBottom:4}}>Priority</label>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["high","High",DANGER],["med","Normal",WG],["low","Low",WG]].map(([v,lbl,c])=>{
          const on=editPriority===v;
          return <button key={v} onClick={()=>setEditPriority(v)} style={{flex:1,padding:"8px 6px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",border:`1.5px solid ${on?c:BD}`,background:on?(v==="high"?"#FBEBE9":PARCH):WHITE,color:on?c:WG}}>{lbl}</button>;
        })}
      </div>
      {jobs.length>0&&<>
        <label style={{...SS.lbl,marginBottom:4}}>Linked job <span style={{textTransform:"none",letterSpacing:0,fontWeight:400,color:WG}}>(optional)</span></label>
        <JobPicker jobs={jobs} clients={clients} value={editJob} onChange={setEditJob} onOpen={openJob}/>
      </>}
      <label style={{...SS.lbl,marginBottom:4}}>Due date <span style={{textTransform:"none",letterSpacing:0,fontWeight:400,color:WG}}>(optional)</span></label>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
        <input type="date" value={editDue} onChange={e=>setEditDue(e.target.value)} style={{...SS.inp,marginTop:0,width:200}}/>
        {editDue&&<Btn sm ghost onClick={()=>setEditDue("")}>Clear</Btn>}
      </div>
      <label style={{...SS.lbl,marginBottom:4}}>Notes / details</label>
      <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} rows={6} placeholder="Add any extra detail — specs, measurements, links, reminders…" style={{...SS.inp,marginTop:0,resize:"vertical",lineHeight:1.5,fontFamily:"inherit"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:22}}>
        <Btn sm danger onClick={()=>{removeItem(editingItem.id);closeEdit();}}>Delete task</Btn>
        <div style={{display:"flex",gap:10}}>
          <Btn sm ghost onClick={closeEdit}>Cancel</Btn>
          <Btn sm onClick={saveEdit}>Save</Btn>
        </div>
      </div>
    </Modal>}
  </div>;
}

// ── Stock / inventory ─────────────────────────────────────────────────────
const STOCK_CATEGORIES=[
  {name:"Ring",prefix:"RNG"},{name:"Necklace",prefix:"NCK"},{name:"Pendant",prefix:"PND"},
  {name:"Earrings",prefix:"EAR"},{name:"Bracelet",prefix:"BRC"},{name:"Bangle",prefix:"BNG"},
  {name:"Chain",prefix:"CHN"},{name:"Brooch",prefix:"BRO"},{name:"Cufflinks",prefix:"CFL"},
  {name:"Loose stone",prefix:"STN"},{name:"Other",prefix:"GEN"},
];
const STOCK_STATUS=[
  {name:"Available",color:OK},{name:"Reserved",color:WARN},{name:"On display",color:GOLD_D},
  {name:"Consignment",color:"#96627C"},{name:"Sold",color:WG},
];
const STOCK_MAKE=["Overseas made","Cast & assembly made","Handmade","Custom made"];
const stockStatusColor=s=>(STOCK_STATUS.find(x=>x.name===s)||{}).color||WG;
// True margin, GST-excluded: the retail price is GST-inclusive but the cost is ex-GST, so we
// back GST out of the sell price before comparing — matching the price builder's "excl. GST"
// profit line. Returns {profit, pct} (both ex-GST) or null when price/cost aren't both set.
const stockMargin=(price,cost)=>{
  const p=Number(price),c=Number(cost);
  if(!(p>0)||!(c>0))return null;
  const exGst=p/(1+GST_RATE);
  return{profit:exGst-c,pct:Math.round((exGst-c)/exGst*100)};
};

const GEM_TYPES=["Diamond","Sapphire","Ruby","Emerald","Opal","Pearl","Aquamarine","Topaz","Amethyst","Garnet","Tourmaline","Tanzanite","Spinel","Morganite","Other"];
const GEM_SHAPES=["","Round","Oval","Cushion","Princess","Emerald","Pear","Marquise","Radiant","Asscher","Heart","Trillion","Baguette","Cabochon","Other"];
const PIECE_TYPES=["Ring","Necklace","Pendant","Bracelet","Bangle","Earrings","Brooch","Watch","Chain","Cufflinks","Other"];

// ── Gem Custody — safekeeping register + printable receipt ─────────────────
// Log any client-owned stone you're physically holding, and print a receipt as
// proof for the customer. It's a bailment record: ownership stays with the client.
function GemCustody({custody,setCustody,clients,biz}){
  const isMobile=useIsMobile();
  const save=next=>{if(!guardEdit())return;setCustody(next);persist(K.gc,next);};
  const[draft,setDraft]=useState(null);        // the record open in the modal (new or edit)
  const[filter,setFilter]=useState("Holding"); // Holding | Returned | All
  const[qStr,setQStr]=useState("");

  const blankItem=(kind="stone")=>({id:uid(),kind,type:kind==="piece"?"Ring":"Diamond",carat:"",shape:"",colour:"",clarity:"",measurements:"",cert:"",estValue:"",notes:"",metal:"",stones:"",condition:""});
  const blank=()=>({id:uid(),clientId:"",clientName:"",clientContact:"",dateReceived:today(),reason:"",expectedReturn:"",notes:"",status:"Holding",createdAt:today(),items:[blankItem()],images:[]});

  const[modalUrls,setModalUrls]=useState({});   // path → signed url for the open record's photos
  const[busy,setBusy]=useState(false);
  const[imgErr,setImgErr]=useState("");

  const openNew=()=>setDraft(blank());
  const openEdit=r=>setDraft(JSON.parse(JSON.stringify(r)));   // deep clone so item edits don't mutate state
  const close=()=>{setDraft(null);setModalUrls({});setBusy(false);setImgErr("");};

  // Resolve signed URLs for the record open in the editor (so existing photos show on edit)
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!draft||!imagesEnabled())return;
      const map={};
      for(const img of (draft.images||[])){const u=await signedImageUrl(img.path);if(u)map[img.path]=u;}
      if(!cancelled)setModalUrls(map);
    })();
    return()=>{cancelled=true;};
  },[draft?.id]);   // eslint-disable-line

  const onFiles=async(fileList)=>{
    if(!draft)return;
    const files=Array.from(fileList||[]).filter(f=>f.type.startsWith("image/"));
    if(!files.length)return;
    setBusy(true);setImgErr("");
    try{
      const added=[];
      for(const file of files){
        const blob=await compressImage(file);
        const path=await uploadJobImage(draft.id,blob);
        const u=await signedImageUrl(path);
        added.push({id:uid(),path,uploadedAt:new Date().toISOString()});
        if(u)setModalUrls(prev=>({...prev,[path]:u}));
      }
      setDraft(d=>({...d,images:[...(d.images||[]),...added]}));
    }catch(e){setImgErr(e.message||"Upload failed.");}
    setBusy(false);
  };
  const removeImg=img=>{
    if(!confirm("Remove this photo?"))return;
    setDraft(d=>({...d,images:(d.images||[]).filter(i=>i.id!==img.id)}));
    deleteJobImage(img.path);
  };

  const setF=k=>v=>setDraft(d=>({...d,[k]:v}));
  const pickClient=id=>{const c=clients.find(x=>x.id===id);setDraft(d=>({...d,clientId:id,clientName:c?clientDisplayName(c):d.clientName,clientContact:c?[c.email,c.phone].filter(Boolean).join(" · "):d.clientContact}));};
  const setItem=(iid,k,v)=>setDraft(d=>({...d,items:d.items.map(it=>it.id===iid?{...it,[k]:v}:it)}));
  // Switch an item between loose stone and jewellery piece; reset its type to that kind's default
  const setKind=(iid,kind)=>setDraft(d=>({...d,items:d.items.map(it=>it.id===iid?{...it,kind,type:kind==="piece"?(PIECE_TYPES.includes(it.type)?it.type:"Ring"):(GEM_TYPES.includes(it.type)?it.type:"Diamond")}:it)}));
  const addItem=(kind="stone")=>setDraft(d=>({...d,items:[...d.items,blankItem(kind)]}));
  const removeItem=iid=>setDraft(d=>({...d,items:d.items.length>1?d.items.filter(it=>it.id!==iid):d.items}));

  const commit=()=>{
    const d=draft;
    const picked=clients.find(c=>c.id===d.clientId);
    const name=(d.clientName||"").trim()||(picked?clientDisplayName(picked):"");
    if(!name){alert("Add the client's name — pick an existing client or type a name.");return;}
    const clean={...d,clientName:name};
    save(custody.some(r=>r.id===d.id)?custody.map(r=>r.id===d.id?clean:r):[clean,...custody]);
    close();
  };
  const del=id=>{if(!confirm("Delete this safekeeping receipt? This can't be undone."))return;save(custody.filter(r=>r.id!==id));close();};
  const toggleReturned=r=>save(custody.map(x=>x.id===r.id?{...x,status:x.status==="Returned"?"Holding":"Returned",returnedAt:x.status==="Returned"?"":today()}:x));

  const itemsValue=r=>(r.items||[]).reduce((s,it)=>s+(Number(it.estValue)||0),0);
  const itemLabel=it=>it.kind==="piece"
    ?[it.metal,it.type,it.stones?`with ${it.stones}`:""].filter(Boolean).join(" ")||it.type||"Piece"
    :[it.carat?`${it.carat}ct`:"",it.shape,it.type].filter(Boolean).join(" ")||it.type||"Gem";
  const resolveClient=r=>clients.find(c=>c.id===r.clientId)||null;

  const holding=custody.filter(r=>r.status!=="Returned");
  const totalHeldValue=holding.reduce((s,r)=>s+itemsValue(r),0);

  const shown=custody.filter(r=>{
    if(filter==="Holding"&&r.status==="Returned")return false;
    if(filter==="Returned"&&r.status!=="Returned")return false;
    if(qStr){const s=`${r.clientName||""} ${(r.items||[]).map(i=>`${i.type} ${i.metal||""} ${i.stones||""} ${i.cert||""}`).join(" ")} ${r.reason||""}`.toLowerCase();if(!s.includes(qStr.toLowerCase()))return false;}
    return true;
  }).sort((a,b)=>{
    const ar=a.status==="Returned"?1:0,br=b.status==="Returned"?1:0;
    if(ar!==br)return ar-br;
    return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
  });

  const smInp={...SS.inp,padding:"8px 10px",fontSize:12.5,marginTop:3};

  return <div>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:16,marginBottom:24}}>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:WG,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>Client-owned items</div>
        <h1 style={{margin:0,fontSize:32,fontWeight:700,color:INK,letterSpacing:"-0.02em",fontFamily:"'Poppins',sans-serif"}}>Safekeeping</h1>
        <div style={{color:INK,fontSize:15,marginTop:6,lineHeight:1.5}}>Log any client-owned stone or piece of jewellery you're holding, and print a receipt as proof for the customer.</div>
      </div>
      <Btn onClick={openNew}>+ New receipt</Btn>
    </div>

    {custody.length===0
      ? <Card style={{marginTop:4}}><div style={{color:WG,fontSize:14,textAlign:"center",padding:"46px 0"}}>
          <div style={{fontWeight:700,fontSize:16,color:INK,marginBottom:6}}>Nothing in safekeeping yet</div>
          <div style={{maxWidth:400,margin:"0 auto 18px",lineHeight:1.55}}>When a client leaves a stone or a piece of jewellery with you, record it here and print a signed receipt so they have proof you're holding it.</div>
          <Btn onClick={openNew}>+ Create your first receipt</Btn>
        </div></Card>
      : <>
          {/* Summary */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:22}}>
            <Stat label="Currently holding" value={holding.length} tint="slate"/>
            <Stat label="Declared value held" value={fmtR(totalHeldValue)} sub="client-declared, for reference"/>
            <Stat label="Returned" value={custody.length-holding.length}/>
          </div>

          {/* Filters */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
            {["Holding","Returned","All"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{padding:"7px 15px",borderRadius:2,border:`1px solid ${filter===f?INK:"#C9BFAE"}`,background:filter===f?INK:"transparent",color:filter===f?WHITE:INK,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>{f}</button>
            ))}
            <input value={qStr} onChange={e=>setQStr(e.target.value)} placeholder="Search client, item or certificate…" style={{...SS.inp,marginTop:0,maxWidth:isMobile?"none":280,width:isMobile?"100%":undefined}}/>
          </div>

          {shown.length===0
            ? <Card><div style={{color:WG,textAlign:"center",padding:"28px 0"}}>No receipts match.</div></Card>
            : shown.map(r=>{
                const c=resolveClient(r);
                const returned=r.status==="Returned";
                const val=itemsValue(r);
                return <Card key={r.id}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:220}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:4}}>
                        <span style={{fontWeight:800,fontSize:16,color:INK}}>{r.clientName||clientDisplayName(c)||"—"}</span>
                        <Badge label={returned?"Returned":"Holding"} color={returned?WG:OK}/>
                        <span style={{fontSize:11,color:WG,letterSpacing:"0.04em"}}>#{r.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <div style={{fontSize:13.5,color:INK,marginBottom:4}}>{(r.items||[]).map(itemLabel).join(" · ")||"No items listed"}</div>
                      <div style={{fontSize:12.5,color:WG}}>
                        Received {fmtDate(r.dateReceived||r.createdAt)}
                        {r.expectedReturn?` · Return by ${fmtDate(r.expectedReturn)}`:""}
                        {val>0?` · Declared ${fmtR(val)}`:""}
                        {(r.images||[]).length?` · 📷 ${(r.images||[]).length}`:""}
                        {returned&&r.returnedAt?` · Returned ${fmtDate(r.returnedAt)}`:""}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <Btn sm={!isMobile} xs={isMobile} onClick={()=>printGemCustodyReceipt(biz||{},c,r)}>Print / Save PDF</Btn>
                      <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>toggleReturned(r)}>{returned?"Reopen":"Mark returned"}</Btn>
                      <Btn sm={!isMobile} xs={isMobile} ghost onClick={()=>openEdit(r)}>Edit</Btn>
                    </div>
                  </div>
                </Card>;
              })}
        </>}

    {/* New / edit modal */}
    {draft&&<Modal wide title={custody.some(r=>r.id===draft.id)?"Edit safekeeping receipt":"New safekeeping receipt"} onClose={close}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="Existing client" value={draft.clientId} onChange={pickClient} as="select" options={[{value:"",label:"— Not a saved client —"},...clients.map(c=>({value:c.id,label:clientDisplayName(c)}))]}/>
        <Input label="Client name (on receipt)" value={draft.clientName} onChange={setF("clientName")} placeholder="Jane Smith"/>
        <Input label="Client contact (optional)" value={draft.clientContact} onChange={setF("clientContact")} placeholder="email · phone"/>
        <div/>
        <Input label="Date received" value={draft.dateReceived} onChange={setF("dateReceived")} type="date"/>
        <Input label="Expected return (optional)" value={draft.expectedReturn} onChange={setF("expectedReturn")} type="date"/>
      </div>
      <Input label="Reason held / instructions" value={draft.reason} onChange={setF("reason")} as="textarea" rows={2} placeholder="e.g. Client's own diamond, left for resetting into a new engagement ring."/>

      <div style={{margin:"6px 0 8px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <label style={SS.lbl}>Items held</label>
        <div style={{display:"flex",gap:8}}>
          <Btn sm ghost onClick={()=>addItem("stone")}>+ Stone</Btn>
          <Btn sm ghost onClick={()=>addItem("piece")}>+ Piece</Btn>
        </div>
      </div>
      {draft.items.map((it,i)=>{
        const piece=it.kind==="piece";
        return <div key={it.id} style={{border:`1px solid ${BD}`,borderRadius:5,padding:"14px 16px",marginBottom:12,background:PARCH}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>{piece?"Piece":"Stone"} {i+1}</span>
              <div style={{display:"inline-flex",border:`1px solid ${BD}`,borderRadius:3,overflow:"hidden"}}>
                {[["stone","Loose stone"],["piece","Jewellery piece"]].map(([k,lbl])=>(
                  <button key={k} onClick={()=>setKind(it.id,k)} style={{padding:"4px 10px",border:"none",background:it.kind===k?INK:WHITE,color:it.kind===k?WHITE:INK,fontSize:10.5,fontWeight:700,letterSpacing:"0.04em",cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
                ))}
              </div>
            </div>
            {draft.items.length>1&&<button onClick={()=>removeItem(it.id)} style={{background:"none",border:"none",color:DANGER,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>}
          </div>
          {piece
            ? <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                <div><label style={SS.lbl}>Piece</label><select value={it.type} onChange={e=>setItem(it.id,"type",e.target.value)} style={smInp}>{PIECE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                <div><label style={SS.lbl}>Metal</label><input value={it.metal} onChange={e=>setItem(it.id,"metal",e.target.value)} placeholder="18ct yellow gold" style={smInp}/></div>
                <div><label style={SS.lbl}>Size / measurements</label><input value={it.measurements} onChange={e=>setItem(it.id,"measurements",e.target.value)} placeholder="Ring size N · 45cm" style={smInp}/></div>
                <div style={{gridColumn:"span 2"}}><label style={SS.lbl}>Stone(s) set in the piece</label><input value={it.stones} onChange={e=>setItem(it.id,"stones",e.target.value)} placeholder="e.g. 1.00ct round diamond centre + 2 sapphire accents" style={smInp}/></div>
                <div><label style={SS.lbl}>Certificate / appraisal #</label><input value={it.cert} onChange={e=>setItem(it.id,"cert",e.target.value)} placeholder="GIA / valuation no." style={smInp}/></div>
                <div><label style={SS.lbl}>Condition on arrival</label><input value={it.condition} onChange={e=>setItem(it.id,"condition",e.target.value)} placeholder="e.g. light wear, no damage" style={smInp}/></div>
                <div><label style={SS.lbl}>{`Declared value (${CUR_SYM})`}</label><input value={it.estValue} onChange={e=>setItem(it.id,"estValue",e.target.value)} placeholder="0" type="number" min="0" style={smInp}/></div>
                <div><label style={SS.lbl}>Notes</label><input value={it.notes} onChange={e=>setItem(it.id,"notes",e.target.value)} placeholder="hallmarks, inscriptions…" style={smInp}/></div>
              </div>
            : <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                <div><label style={SS.lbl}>Type</label><select value={it.type} onChange={e=>setItem(it.id,"type",e.target.value)} style={smInp}>{GEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                <div><label style={SS.lbl}>Carat</label><input value={it.carat} onChange={e=>setItem(it.id,"carat",e.target.value)} placeholder="1.20" style={smInp}/></div>
                <div><label style={SS.lbl}>Shape / cut</label><select value={it.shape} onChange={e=>setItem(it.id,"shape",e.target.value)} style={smInp}>{GEM_SHAPES.map(s=><option key={s} value={s}>{s||"—"}</option>)}</select></div>
                <div><label style={SS.lbl}>Colour</label><input value={it.colour} onChange={e=>setItem(it.id,"colour",e.target.value)} placeholder="e.g. F" style={smInp}/></div>
                <div><label style={SS.lbl}>Clarity</label><input value={it.clarity} onChange={e=>setItem(it.id,"clarity",e.target.value)} placeholder="e.g. VS1" style={smInp}/></div>
                <div><label style={SS.lbl}>Measurements</label><input value={it.measurements} onChange={e=>setItem(it.id,"measurements",e.target.value)} placeholder="6.8 × 6.8 × 4.2mm" style={smInp}/></div>
                <div><label style={SS.lbl}>Certificate #</label><input value={it.cert} onChange={e=>setItem(it.id,"cert",e.target.value)} placeholder="GIA / IGI no." style={smInp}/></div>
                <div><label style={SS.lbl}>{`Declared value (${CUR_SYM})`}</label><input value={it.estValue} onChange={e=>setItem(it.id,"estValue",e.target.value)} placeholder="0" type="number" min="0" style={smInp}/></div>
                <div><label style={SS.lbl}>Notes</label><input value={it.notes} onChange={e=>setItem(it.id,"notes",e.target.value)} placeholder="marks, inscriptions…" style={smInp}/></div>
              </div>}
        </div>;
      })}

      <label style={{...SS.lbl,marginTop:6,marginBottom:0}}>Photos of the item(s)</label>
      {!imagesEnabled()
        ? <div style={{fontSize:12,color:WG,lineHeight:1.55,marginTop:4}}>Photo uploads need the cloud backend — sign in on the deployed app to add photos.</div>
        : <div style={{marginTop:6}}>
            <label style={{display:"inline-block",background:GOLD,color:WHITE,borderRadius:4,padding:"7px 15px",fontSize:12,fontWeight:700,cursor:busy?"default":"pointer",letterSpacing:"0.02em",opacity:busy?0.6:1}}>
              {busy?"Uploading…":"+ Upload photos"}
              <input type="file" accept="image/*" multiple disabled={busy} onChange={e=>{onFiles(e.target.files);e.target.value="";}} style={{display:"none"}}/>
            </label>
            {imgErr&&<div style={{color:DANGER,fontSize:12,marginTop:8}}>{imgErr}</div>}
            {(draft.images||[]).length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(84px,1fr))",gap:8,marginTop:10}}>
              {(draft.images||[]).map(img=>(
                <div key={img.id} style={{position:"relative",aspectRatio:"1 / 1",borderRadius:4,overflow:"hidden",border:`1px solid ${BD}`,background:`${PARCH} center/cover no-repeat`,backgroundImage:modalUrls[img.path]?`url(${modalUrls[img.path]})`:"none"}}>
                  {!modalUrls[img.path]&&<span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:WG}}>loading…</span>}
                  <button onClick={()=>removeImg(img)} title="Remove photo" style={{position:"absolute",top:3,right:3,width:20,height:20,borderRadius:"50%",border:"none",background:"rgba(0,0,0,0.55)",color:WHITE,fontSize:13,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
                </div>
              ))}
            </div>}
          </div>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:18,flexWrap:"wrap"}}>
        <div>{custody.some(r=>r.id===draft.id)&&<Btn sm danger onClick={()=>del(draft.id)}>Delete</Btn>}</div>
        <div style={{display:"flex",gap:10}}>
          <Btn sm ghost onClick={close}>Cancel</Btn>
          <Btn sm onClick={commit}>Save receipt</Btn>
        </div>
      </div>
    </Modal>}
  </div>;
}

function StockBoard({stock,setStock,setView}){
  // Persist + set together. Pass a function to update from the freshest state — this is
  // race-safe: a slow photo upload can't clobber edits (or lose images) made meanwhile.
  const save=next=>{if(!guardEdit())return;setStock(prev=>{const n=typeof next==="function"?next(prev):next;persist(K.st,n);return n;});};

  const[q,setQ]=useState("");
  const[filterCat,setFilterCat]=useState("All");
  const[filterStatus,setFilterStatus]=useState("All");
  const[thumbs,setThumbs]=useState({});       // itemId → signed url of first photo (grid)
  const[editId,setEditId]=useState(null);
  const[isNew,setIsNew]=useState(false);
  const[draft,setDraft]=useState({});
  const[modalUrls,setModalUrls]=useState({}); // path → signed url (editor)
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState("");

  // Resolve a signed URL for each piece's first photo (grid thumbnails)
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!imagesEnabled())return;
      const map={};
      for(const it of stock){const first=(it.images||[])[0];if(first){const u=await signedImageUrl(first.path);if(u)map[it.id]=u;}}
      if(!cancelled)setThumbs(map);
    })();
    return()=>{cancelled=true;};
  },[stock.map(it=>it.id+":"+((it.images||[])[0]?.path||"")).join(",")]);   // eslint-disable-line

  // Resolve signed URLs for the piece currently open in the editor
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const item=stock.find(x=>x.id===editId);
      if(!item||!imagesEnabled())return;
      const map={};
      for(const img of (item.images||[])){const u=await signedImageUrl(img.path);if(u)map[img.path]=u;}
      if(!cancelled)setModalUrls(map);
    })();
    return()=>{cancelled=true;};
  },[editId]);   // eslint-disable-line

  const fields=it=>({title:it.title||"",sku:it.sku||"",category:it.category||"Ring",description:it.description||"",
    metal:it.metal||"",metal2:it.metal2||"",make:it.make||"",stones:it.stones||"",cost:it.cost||"",price:it.price||"",status:it.status||"Available",location:it.location||"",qty:it.qty||1});
  const draftFields=d=>({title:(d.title||"").trim(),sku:(d.sku||"").trim(),category:d.category,description:(d.description||"").trim(),
    metal:d.metal||"",metal2:d.metal2||"",make:d.make||"",stones:(d.stones||"").trim(),cost:d.cost,price:d.price,status:d.status,location:(d.location||"").trim(),qty:Number(d.qty)||1});
  const openEdit=it=>{setEditId(it.id);setIsNew(false);setDraft(fields(it));setErr("");setModalUrls({});};
  const openNew=()=>{
    const it={id:uid(),status:"Available",category:"Ring",qty:1,images:[],createdAt:today(),sku:""};
    save(prev=>[...prev,it]);
    setEditId(it.id);setIsNew(true);setDraft(fields(it));setErr("");setModalUrls({});
  };
  const closeEditor=()=>{
    const item=stock.find(x=>x.id===editId);
    if(isNew&&item&&!(item.title||"").trim()&&!(item.images||[]).length)save(prev=>prev.filter(x=>x.id!==editId));
    setEditId(null);setIsNew(false);
  };
  const saveText=()=>{save(prev=>prev.map(x=>x.id===editId?{...x,...draftFields(draft)}:x));setIsNew(false);setEditId(null);};
  // Commit the piece, then hand off to the quote-engine builder to price it
  const goPrice=()=>{save(prev=>prev.map(x=>x.id===editId?{...x,...draftFields(draft)}:x));setIsNew(false);setView("stockPrice_"+editId);};
  const deletePiece=()=>{
    const item=stock.find(x=>x.id===editId);
    if(!confirm("Delete this stock piece? This can't be undone."))return;
    (item?.images||[]).forEach(img=>deleteJobImage(img.path));
    save(prev=>prev.filter(x=>x.id!==editId));setEditId(null);setIsNew(false);
  };

  // Photo handling on the piece currently open (mirrors the Jobs image flow)
  const onFiles=async(fileList)=>{
    const item=stock.find(x=>x.id===editId);if(!item)return;
    const files=Array.from(fileList||[]).filter(f=>f.type.startsWith("image/"));
    if(!files.length)return;
    setBusy(true);setErr("");
    try{
      const added=[];
      for(const file of files){
        const blob=await compressImage(file);
        const path=await uploadJobImage(item.id,blob);
        const u=await signedImageUrl(path);
        added.push({id:uid(),path,uploadedAt:new Date().toISOString()});
        if(u)setModalUrls(prev=>({...prev,[path]:u}));
      }
      save(prev=>prev.map(x=>x.id===item.id?{...x,images:[...(x.images||[]),...added]}:x));
    }catch(e){setErr(e.message||"Upload failed.");}
    setBusy(false);
  };
  const removeImg=img=>{
    if(!confirm("Remove this photo?"))return;
    save(prev=>prev.map(x=>x.id===editId?{...x,images:(x.images||[]).filter(i=>i.id!==img.id)}:x));
    deleteJobImage(img.path);
  };

  // Summary — value on hand excludes sold pieces
  const live=stock.filter(it=>(it.status||"Available")!=="Sold");
  const retailVal=live.reduce((s,it)=>s+Number(it.price||0)*Number(it.qty||1),0);
  const costVal=live.reduce((s,it)=>s+Number(it.cost||0)*Number(it.qty||1),0);
  // Potential margin is measured ex-GST (retail is GST-inclusive, cost is ex-GST) to match the per-piece figure.
  const marginVal=retailVal/(1+GST_RATE)-costVal;
  const availCount=stock.filter(it=>(it.status||"Available")==="Available").length;

  const cats=["All",...STOCK_CATEGORIES.map(c=>c.name).filter(n=>stock.some(s=>s.category===n))];
  const shown=stock.filter(it=>{
    if(filterCat!=="All"&&it.category!==filterCat)return false;
    if(filterStatus!=="All"&&(it.status||"Available")!==filterStatus)return false;
    if(q){const s=`${it.title||""} ${it.sku||""} ${it.description||""} ${it.make||""}`.toLowerCase();if(!s.includes(q.toLowerCase()))return false;}
    return true;
  }).sort((a,b)=>{
    const as=(a.status||"")==="Sold"?1:0,bs=(b.status||"")==="Sold"?1:0;
    if(as!==bs)return as-bs;
    return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
  });

  const editingItem=stock.find(x=>x.id===editId)||null;

  return <div>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:16,marginBottom:24}}>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:WG,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>Inventory</div>
        <h1 style={{margin:0,fontSize:32,fontWeight:700,color:INK,letterSpacing:"-0.02em",fontFamily:"'Poppins',sans-serif"}}>Stock</h1>
        <div style={{color:INK,fontSize:15,marginTop:6,lineHeight:1.5}}>Your ready-to-sell and display pieces, with photos, SKUs and pricing.</div>
      </div>
      <Btn onClick={openNew}>+ Add piece</Btn>
    </div>

    {stock.length===0
      ? <Card style={{marginTop:4}}><div style={{color:WG,fontSize:14,textAlign:"center",padding:"46px 0"}}>
          <div style={{fontSize:38,marginBottom:12}}>💍</div>
          <div style={{fontWeight:700,fontSize:16,color:INK,marginBottom:6}}>No stock pieces yet</div>
          <div style={{maxWidth:380,margin:"0 auto 18px",lineHeight:1.55}}>Add your first ready-to-sell or display piece — photos, a description, your own SKU and a generated price.</div>
          <Btn onClick={openNew}>+ Add your first piece</Btn>
        </div></Card>
      : <>
          {/* Summary tiles */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(176px,1fr))",gap:14,marginBottom:20}}>
            <Stat label="Pieces" value={stock.length} tint="slate" icon={ICON_RING}/>
            <Stat label="Available" value={availCount} tint="slate" icon={ICON_CHECK}/>
            <Stat label="Retail value" value={fmtR(retailVal)} tint="slate" icon={ICON_DOLLAR} sub="excludes sold"/>
            <Stat label="Potential margin" value={fmtR(marginVal)} tint="slate" icon={ICON_DOLLAR} sub={`cost ${fmtR(costVal)} · excl. ${TAX_LABEL}`}/>
          </div>

          {/* Filter bar */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:18}}>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search title, SKU, description…" style={{...SS.inp,marginTop:0,flex:"1 1 240px",maxWidth:340}}/>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...SS.inp,marginTop:0,width:"auto"}}>{cats.map(c=><option key={c} value={c}>{c==="All"?"All categories":c}</option>)}</select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{...SS.inp,marginTop:0,width:"auto"}}><option value="All">All statuses</option>{STOCK_STATUS.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select>
          </div>

          {shown.length===0
            ? <div style={{fontSize:13,color:WG,fontStyle:"italic",padding:"24px 0",textAlign:"center"}}>No pieces match your search or filters.</div>
            : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:16,alignItems:"start"}}>
                {shown.map(it=>{
                  const url=thumbs[it.id];
                  const margin=stockMargin(it.price,it.cost);
                  const sc=stockStatusColor(it.status);
                  const sold=(it.status||"")==="Sold";
                  return <div key={it.id} onClick={()=>openEdit(it)} style={{background:WHITE,border:`1px solid ${BD_SOFT}`,borderRadius:RADIUS,boxShadow:SHADOW,overflow:"hidden",cursor:"pointer",opacity:sold?0.72:1}}>
                    <div style={{position:"relative",width:"100%",aspectRatio:"1 / 1",background:`${PARCH} center/cover no-repeat`,backgroundImage:url?`url(${url})`:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {!url&&<span style={{fontSize:40,color:BD}}>◈</span>}
                      <span style={{position:"absolute",top:9,left:9}}><Badge label={it.status||"Available"} color={sc}/></span>
                    </div>
                    <div style={{padding:"12px 13px 14px"}}>
                      <div style={{fontWeight:700,fontSize:14,color:INK,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{(it.title||"").trim()||"Untitled piece"}</div>
                      <div style={{fontSize:11,color:WG,fontFamily:"ui-monospace,Menlo,monospace",marginTop:2}}>{it.sku||"—"}</div>
                      <div style={{fontSize:11.5,color:WG,marginTop:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{it.category||"—"}</div>
                      {it.make&&<span style={{display:"inline-block",marginTop:7,fontSize:10,fontWeight:700,color:GOLD_D,background:GOLD_L,borderRadius:3,padding:"2px 7px",letterSpacing:"0.02em"}}>{it.make}</span>}
                      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8,marginTop:8}}>
                        <span style={{fontSize:16,fontWeight:800,color:INK}}>{it.price?fmtR(it.price):"—"}</span>
                        {margin&&<span style={{fontSize:11,fontWeight:700,color:margin.pct>=0?OK:DANGER}}>{margin.pct}% margin</span>}
                      </div>
                    </div>
                  </div>;
                })}
              </div>}
        </>}

    {/* Add / edit piece */}
    {editingItem&&<Modal title={isNew?"New stock piece":"Edit stock piece"} onClose={closeEditor} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 22px"}}>
        {/* Left column */}
        <div>
          <Input label="Title" value={draft.title} onChange={v=>setDraft(d=>({...d,title:v}))} placeholder="e.g. Round diamond solitaire"/>
          <Input label="Category" as="select" value={draft.category} onChange={v=>setDraft(d=>({...d,category:v}))} options={STOCK_CATEGORIES.map(c=>c.name)}/>
          <Input label="Make" as="select" value={draft.make} onChange={v=>setDraft(d=>({...d,make:v}))} options={["",...STOCK_MAKE]}/>
          <Input label="SKU / item code" value={draft.sku} onChange={v=>setDraft(d=>({...d,sku:v}))} placeholder="e.g. RNG-001 (your own code)"/>
          <Input label="Description" as="textarea" rows={4} value={draft.description} onChange={v=>setDraft(d=>({...d,description:v}))} placeholder="Style, finish, notable features…"/>
          <Input label="Status" as="select" value={draft.status} onChange={v=>setDraft(d=>({...d,status:v}))} options={STOCK_STATUS.map(s=>s.name)}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Input label="Location" value={draft.location} onChange={v=>setDraft(d=>({...d,location:v}))} placeholder="e.g. Cabinet A / safe"/>
            <Input label="Quantity" type="number" min="1" value={draft.qty} onChange={v=>setDraft(d=>({...d,qty:v}))}/>
          </div>
        </div>
        {/* Right column */}
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Input label={`Cost price (${CUR_SYM})`} type="number" min="0" value={draft.cost} onChange={v=>setDraft(d=>({...d,cost:v}))}/>
            <Input label={`Retail price (${CUR_SYM})`} type="number" min="0" value={draft.price} onChange={v=>setDraft(d=>({...d,price:v}))}/>
          </div>
          {(()=>{const m=stockMargin(draft.price,draft.cost);return m&&<div style={{fontSize:12,color:WG,marginTop:-4,marginBottom:10}}>Margin: <strong style={{color:OK}}>{fmtR(m.profit)}</strong> · {m.pct}% <span style={{color:WG}}>(excl. {TAX_LABEL})</span></div>;})()}
          {/* Build the price with the same engine as quotes (materials + labour + stones + your markup) */}
          <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:5,padding:"12px 14px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{fontSize:12,color:WG,lineHeight:1.5,flex:"1 1 150px"}}>Build the price the same way you make a quote — it fills in cost &amp; retail above.</div>
              <Btn sm onClick={goPrice}>{editingItem.pricedAt?"Update price":"Generate price"}</Btn>
            </div>
            {editingItem.pricedAt&&<div style={{fontSize:11,color:WG,marginTop:8}}>Priced on {fmtDate(editingItem.pricedAt)} · re-generate if metal or costs have moved.</div>}
          </div>
          {/* Photos */}
          <label style={SS.lbl}>Photos</label>
          {!imagesEnabled()
            ? <div style={{fontSize:12,color:WG,lineHeight:1.55,marginTop:4}}>Photo uploads need the cloud backend — sign in on the deployed app to add photos.</div>
            : <div style={{marginTop:6}}>
                <label style={{display:"inline-block",background:GOLD,color:WHITE,borderRadius:4,padding:"7px 15px",fontSize:12,fontWeight:700,cursor:busy?"default":"pointer",letterSpacing:"0.02em",opacity:busy?0.6:1}}>
                  {busy?"Uploading…":"+ Upload photos"}
                  <input type="file" accept="image/*" multiple disabled={busy} onChange={e=>{onFiles(e.target.files);e.target.value="";}} style={{display:"none"}}/>
                </label>
                {err&&<div style={{color:DANGER,fontSize:12,marginTop:8}}>{err}</div>}
                {(editingItem.images||[]).length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(84px,1fr))",gap:8,marginTop:10}}>
                  {(editingItem.images||[]).map(img=>(
                    <div key={img.id} style={{position:"relative",aspectRatio:"1 / 1",borderRadius:4,overflow:"hidden",border:`1px solid ${BD}`,background:`${PARCH} center/cover no-repeat`,backgroundImage:modalUrls[img.path]?`url(${modalUrls[img.path]})`:"none"}}>
                      {!modalUrls[img.path]&&<span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:WG}}>loading…</span>}
                      <button onClick={()=>removeImg(img)} title="Remove photo" style={{position:"absolute",top:3,right:3,width:20,height:20,borderRadius:"50%",border:"none",background:"rgba(0,0,0,0.55)",color:WHITE,fontSize:13,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
                    </div>
                  ))}
                </div>}
              </div>}
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:24,paddingTop:18,borderTop:`1px solid ${BD}`}}>
        <Btn sm danger onClick={deletePiece}>Delete piece</Btn>
        <div style={{display:"flex",gap:10}}>
          <Btn sm ghost onClick={closeEditor}>Cancel</Btn>
          <Btn sm onClick={saveText}>Save piece</Btn>
        </div>
      </div>
    </Modal>}
  </div>;
}

// True when the viewport is phone-width. Drives the shell's drawer nav + tighter padding.
function useIsMobile(bp=768){
  const[m,setM]=useState(typeof window!=="undefined"&&window.innerWidth<bp);
  useEffect(()=>{
    const on=()=>setM(window.innerWidth<bp);
    window.addEventListener("resize",on);
    return()=>window.removeEventListener("resize",on);
  },[bp]);
  return m;
}

export default function App(){
  // Public client-facing proposal link (?p=<token>) — render the standalone proposal page,
  // outside the auth gate and the studio shell. Derived from the URL (constant per page load).
  const _publicToken=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("p"):null;
  if(_publicToken)return <PublicProposalPage token={_publicToken}/>;

  const[clients,setClients]=useState(SEED_CLIENTS);
  const[jobs,setJobs]=useState(SEED_JOBS);
  const[quotes,setQuotes]=useState(SEED_QUOTES);
  const[payments,setPayments]=useState(SEED_PAYMENTS);
  const[pricing,setPricing]=useState(SEED_PRICING);
  const[biz,setBiz]=useState({});
  const[notes,setNotes]=useState(SEED_NOTES);
  const[invoices,setInvoices]=useState([]);
  const[proposals,setProposals]=useState([]);
  const[appointments,setAppointments]=useState(SEED_APPOINTMENTS);
  const[spotPrices,setSpotPrices]=useState(SEED_SPOT);
  const[spotModal,setSpotModal]=useState(false);   // "Update metal spot prices" — app-level so it opens from anywhere
  const[markupTable,setMarkupTable]=useState(DEFAULT_MARKUP_TABLE);
  const[naturalStoneMarkup,setNaturalStoneMarkup]=useState(DEFAULT_NATURAL_STONE_MARKUP);
  const[labStoneMarkup,setLabStoneMarkup]=useState(DEFAULT_LAB_STONE_MARKUP);
  const[tradeMarkupTable,setTradeMarkupTable]=useState(DEFAULT_TRADE_MARKUP_TABLE);        // trade profile: lower wholesale markups
  const[tradeNatStoneMarkup,setTradeNatStoneMarkup]=useState(DEFAULT_TRADE_NATURAL_STONE_MARKUP);
  const[tradeLabStoneMarkup,setTradeLabStoneMarkup]=useState(DEFAULT_TRADE_LAB_STONE_MARKUP);
  const[subscription,setSubscription]=useState(null);   // studio billing fields (null = full access)
  const[centreRates,setCentreRates]=useState(DEFAULT_SETTING_RATES);   // holds the unified settingRates object
  const[todos,setTodos]=useState({people:[],items:[]});
  const[stock,setStock]=useState([]);
  const[gemCustody,setGemCustody]=useState([]);
  const[view,setViewRaw]=useState("dashboard");
  const[selClient,setSelClient]=useState(null);
  const[selJob,setSelJob]=useState(null);
  const[storageReady,setStorageReady]=useState(false);
  const[loadError,setLoadError]=useState(false);
  const[loadNonce,setLoadNonce]=useState(0);
  const isMobile=useIsMobile();
  const[drawerOpen,setDrawerOpen]=useState(false);
  const[session,setSession]=useState(null);
  const[authReady,setAuthReady]=useState(!supabaseEnabled);
  // Stable across token refreshes — only changes on real sign-in/out
  const userId=session?.user?.id||null;
  // Which studio (tenant) this user belongs to. null = not resolved yet,
  // "none" = signed in but linked to no studio (→ onboarding, phase 2).
  const[studioId,setStudioId]=useState(null);

  // Auth: track Supabase session (no-op when Supabase isn't configured → local mode)
  useEffect(()=>{
    if(!supabaseEnabled){setCloudActive(false);return;}
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session||null);setCloudActive(!!data.session);setAuthReady(true);
    });
    const{data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{
      setSession(s||null);setCloudActive(!!s);
    });
    return()=>{try{sub.subscription.unsubscribe();}catch(e){}};
  },[]);

  // Resolve the user's studio once we have a session, before any data loads.
  useEffect(()=>{
    if(!supabaseEnabled||!userId){setStudioIdModule(null);setStudioId(null);return;}
    // Hold the loading screen until THIS account's studio is resolved and its data has
    // loaded — otherwise a previously signed-in studio's in-memory data flashes (or worse,
    // gets written into the new studio) during an account switch on the same browser.
    setStorageReady(false);
    let cancelled=false;
    (async()=>{
      try{
        const{data}=await supabase.from("studio_members").select("studio_id").eq("user_id",userId).limit(1).maybeSingle();
        if(cancelled)return;
        if(data&&data.studio_id){
          setStudioIdModule(data.studio_id);setStudioId(data.studio_id);
          // Load the studio's subscription status (billing fields). Absent columns/rows → null = full access.
          if(BILLING_ENABLED)supabase.from("studios").select("sub_status,plan,trial_ends_at,current_period_end").eq("id",data.studio_id).maybeSingle().then(({data:s})=>{if(!cancelled)setSubscription(s||null);}).catch(()=>{});
        }
        else{
          // No studio yet — if they followed a teammate invite link, join that studio instead of onboarding.
          let joined=false;
          try{
            const token=localStorage.getItem("pendingInvite");
            if(token){
              const{data:sid,error}=await supabase.rpc("accept_studio_invite",{p_token:token});
              try{localStorage.removeItem("pendingInvite");}catch(_){}
              if(!cancelled&&sid&&!error){
                joined=true;setStudioIdModule(sid);setStudioId(sid);
                if(BILLING_ENABLED)supabase.from("studios").select("sub_status,plan,trial_ends_at,current_period_end").eq("id",sid).maybeSingle().then(({data:s})=>{if(!cancelled)setSubscription(s||null);}).catch(()=>{});
              }
            }
          }catch(_){try{localStorage.removeItem("pendingInvite");}catch(__){}}
          if(!joined&&!cancelled){setStudioIdModule(null);setStudioId("none");}
        }
      }catch(e){if(!cancelled){setStudioIdModule(null);setStudioId("none");}}
    })();
    return()=>{cancelled=true;};
  },[userId]);

  // Stay current when returning to the tab / switching computers: pick up a new deployment (reload)
  // AND silently re-sync data (catch anything the live channel missed while the tab was asleep).
  // The data re-sync fires on focus/visibility-return only (not mid-work), is throttled to ≥20s,
  // skips while a field is focused, and re-runs the load effect silently (no loading flash; a blip
  // keeps existing data). A separate 5-min timer only checks for a new build.
  useEffect(()=>{
    let lastSync=Date.now();
    const onReturn=()=>{
      checkForUpdate();
      const el=document.activeElement;
      const typing=el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable);
      if(!typing&&Date.now()-lastSync>20000){lastSync=Date.now();setLoadNonce(n=>n+1);}
    };
    const onVis=()=>{if(document.visibilityState==="visible")onReturn();};
    document.addEventListener("visibilitychange",onVis);
    window.addEventListener("focus",onReturn);
    const iv=setInterval(()=>{if(document.visibilityState==="visible")checkForUpdate();},5*60*1000);
    return()=>{document.removeEventListener("visibilitychange",onVis);window.removeEventListener("focus",onReturn);clearInterval(iv);};
  },[]);

  // Keep the pure-calc globals (used by calcQuote/jobChargeTotal) in sync with business
  // settings on EVERY render — synchronously, before children compute. Doing this in a
  // useEffect instead runs one render too late, so the first paint after load computes
  // figures like "balance owing by job" with the default buffer/rounding, showing wrong
  // values for a moment until the effect fires and a re-render snaps them correct.
  setMarkupBuffer(biz?.markupBuffer||0);
  setQuoteRounding(biz?.quoteRounding||0);

  // Load all persisted data on mount
  useEffect(()=>{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return ()=>{try{document.head.removeChild(link);}catch(e){}};
  },[]);

  useEffect(()=>{
    // Wait until we know the auth state. In cloud mode, only load once logged in
    // AND once the user's studio is resolved to a real id (so reads/writes scope).
    if(!authReady)return;
    if(supabaseEnabled&&!userId)return;
    if(supabaseEnabled&&(!studioId||studioId==="none"))return;

    const keyToSetter={
      [K.cl]:setClients,[K.jo]:setJobs,[K.qu]:setQuotes,[K.pa]:setPayments,
      [K.pr]:setPricing,[K.biz]:setBiz,[K.no]:setNotes,[K.inv]:setInvoices,
      [K.mt]:setMarkupTable,[K.smn]:setNaturalStoneMarkup,[K.sml]:setLabStoneMarkup,[K.csr]:setCentreRates,
      [K.ap]:setAppointments,[K.pp]:setProposals,[K.td]:setTodos,[K.st]:setStock,
      [K.gc]:setGemCustody,[K.spot]:setSpotPrices,
      [K.tmt]:setTradeMarkupTable,[K.tsmn]:setTradeNatStoneMarkup,[K.tsml]:setTradeLabStoneMarkup,
    };
    // When a studio has no saved row for a key (a brand-new/empty studio, or one that just
    // switched in), reset that slice to a CLEAN default rather than leaving the previously
    // loaded studio's value in memory. Data lists → empty; catalogue/settings → seed defaults
    // so a new studio is immediately usable. Keys must match keyToSetter exactly.
    const studioDefaults={
      [K.cl]:[],[K.jo]:[],[K.qu]:[],[K.pa]:[],[K.no]:[],[K.inv]:[],[K.pp]:[],[K.ap]:[],
      [K.td]:{people:[],items:[]},[K.st]:[],[K.gc]:[],[K.biz]:{},
      [K.pr]:SEED_PRICING,[K.mt]:DEFAULT_MARKUP_TABLE,[K.smn]:DEFAULT_NATURAL_STONE_MARKUP,
      [K.sml]:DEFAULT_LAB_STONE_MARKUP,[K.csr]:DEFAULT_SETTING_RATES,[K.spot]:SEED_SPOT,
      [K.tmt]:DEFAULT_TRADE_MARKUP_TABLE,[K.tsmn]:DEFAULT_TRADE_NATURAL_STONE_MARKUP,[K.tsml]:DEFAULT_TRADE_LAB_STONE_MARKUP,
    };
    // Normalise legacy values before applying to state
    const applyLoaded=(k,v,setter)=>{
      if(v===null||v===undefined)return;
      if(k===K.pr&&Array.isArray(v)){
        // Drop any retired catalogue items so they don't reappear after deletion
        v=v.filter(it=>it&&!RETIRED_PRICING_IDS.has(it.id));
        v=v.map(it=>it&&it.category==="Findings / Components / Purchased Parts"?{...it,category:FINDINGS_CAT}:it);
        // Sync structural fields from seed onto existing items, preserving the user's editable
        // fields (price, and any custom name/detail they've set) so renames/edits aren't reverted.
        const seedById=Object.fromEntries(SEED_PRICING.map(x=>[x.id,x]));
        v=v.map(it=>{if(!it)return it;const seed=seedById[it.id];if(!seed)return it;return{...seed,baseCost:it.baseCost,name:it.name??seed.name,detail:it.detail??seed.detail};});
        // Preserve the user's saved order so drag-reorder sticks. Insert only brand-new seed
        // items, slotting each beside its nearest preceding seed neighbour rather than
        // re-sorting the whole list (which would undo any manual reordering).
        const present=new Set(v.map(x=>x.id));
        SEED_PRICING.forEach((m,seedIdx)=>{
          if(present.has(m.id)||_deletedSeedIds.has(m.id))return;   // skip items the user has deleted
          let pos=v.length;   // fallback: append at the end
          for(let i=seedIdx-1;i>=0;i--){const j=v.findIndex(x=>x.id===SEED_PRICING[i].id);if(j>=0){pos=j+1;break;}}
          v.splice(pos,0,m);
          present.add(m.id);
        });
      }
      if(k===K.jo&&Array.isArray(v)){
        v=v.map(j=>{if(!j)return j;if(j.stage==="Wax / Cast")return{...j,stage:"Manufacturing"};if(j.stage==="Render approval")return{...j,stage:"Design / CAD"};return j;});   // renamed/removed stages
      }
      if(k===K.csr)v=normalizeSettingRates(v);   // migrate legacy centre rates → unified setting-rates shape
      _known[k]=v;   // merge base: the value we're now in sync with (used by the concurrent-write merge)
      setter(v);
    };

    const cloudMode=supabaseEnabled&&userId&&supabase;
    // Hard timeout — if the cloud hangs, surface an error rather than booting on seed data
    const giveUp=setTimeout(()=>{
      if(cloudMode&&!_cloudLoaded)setLoadError(true);
      setStorageReady(true);
    },9000);
    const init=async()=>{
      setLoadError(false);
      // Load the user's deleted built-in items before the pricing reconcile, so they aren't re-added.
      try{const dl=await (cloudMode?_cloudGet(K.delpr):_localGet(K.delpr));_deletedSeedIds.clear();if(Array.isArray(dl))dl.forEach(id=>_deletedSeedIds.add(id));}catch(e){}
      if(cloudMode){
        // Strict load: ALL keys must read from the cloud before we allow any cloud writes.
        // If the cloud can't be reached, we block the app instead of risking an overwrite.
        try{
          const entries=Object.entries(keyToSetter);
          const values=await Promise.all(entries.map(([k])=>_cloudGet(k)));
          entries.forEach(([k,setter],i)=>{
            const v=values[i];
            if(v===null||v===undefined){if(k in studioDefaults){_known[k]=studioDefaults[k];setter(studioDefaults[k]);}}   // empty studio → clean default, never the prior studio's data
            else applyLoaded(k,v,setter);
          });
          setCloudLoaded(true);   // ✅ now safe to persist to the cloud
        }catch(e){
          clearTimeout(giveUp);
          // First load failing blocks the app (don't boot/write on seed data). A later background
          // refresh (cloud already loaded once) failing is harmless — keep the data we have and
          // stay writable, so a flaky reconnect never throws up the error screen.
          if(!_cloudLoaded){setCloudLoaded(false);setLoadError(true);setStorageReady(true);}
          return;
        }
      }else{
        for(const[k,setter] of Object.entries(keyToSetter)){
          try{const v=await _localGet(k);applyLoaded(k,v,setter);}catch(e){}
        }
      }
      clearTimeout(giveUp);
      setStorageReady(true);
    };
    init().catch(()=>{clearTimeout(giveUp);if(cloudMode)setLoadError(true);setStorageReady(true);});

    // Live sync: apply changes made on other computers
    let channel=null;
    if(supabaseEnabled&&userId&&supabase){
      channel=supabase.channel("studio_state_changes")
        .on("postgres_changes",{event:"*",schema:"public",table:STATE_TABLE,filter:`studio_id=eq.${_studioId}`},(payload)=>{
          const row=payload.new&&Object.keys(payload.new).length?payload.new:null;
          if(!row)return;
          // Ignore echoes of our own writes (and any snapshot at/older than our last write
          // for this key) — otherwise a stale echo overwrites fresh state and sticks until
          // reload. Genuine changes from another device carry a newer timestamp and apply.
          const mine=_lastWriteAt[row.key];
          if(mine&&row.updated_at&&new Date(row.updated_at).getTime()<=new Date(mine).getTime())return;
          const setter=keyToSetter[row.key];
          if(setter)applyLoaded(row.key,row.value,setter);
        })
        .subscribe();
    }
    return()=>{clearTimeout(giveUp);if(channel&&supabase){try{supabase.removeChannel(channel);}catch(e){}}};
  },[authReady,userId,studioId,loadNonce]);

  // Apply a view token (…_id forms select the record first, then switch the raw view).
  const applyView=useCallback(v=>{
    if(v.startsWith("clientDetail_")){setSelClient(v.split("_")[1]);setViewRaw("clientDetail");}
    else if(v.startsWith("jobDetail_")){setSelJob(v.split("_")[1]);setViewRaw("jobDetail");}
    else setViewRaw(v);
  },[]);
  // Navigation history → one global Back button that works on every page. selJob/selClient
  // live in separate state, so detail views are remembered by their resolvable token
  // ("jobDetail_<id>" / "clientDetail_<id>"). navRef mirrors the current location each render.
  const navRef=useRef({view:"dashboard",selClient:null,selJob:null});
  navRef.current={view,selClient,selJob};
  const histRef=useRef([]);
  const[histLen,setHistLen]=useState(0);
  const tokenOf=s=>s.view==="jobDetail"?"jobDetail_"+(s.selJob||""):s.view==="clientDetail"?"clientDetail_"+(s.selClient||""):s.view;
  const setView=useCallback(v=>{
    const cur=tokenOf(navRef.current);
    if(cur&&cur!==v){histRef.current.push(cur);if(histRef.current.length>50)histRef.current.shift();setHistLen(histRef.current.length);}
    applyView(v);
  },[applyView]);
  const goBack=useCallback(()=>{
    const prev=histRef.current.pop();
    setHistLen(histRef.current.length);
    if(prev)applyView(prev);
  },[applyView]);
  // Open the Jobs list pre-filtered from a dashboard tile (e.g. "ready", "owing", "overdue").
  const[jobsPreset,setJobsPreset]=useState(null);
  const openJobs=useCallback(p=>{setJobsPreset(p);setView("jobs");},[setView]);

  // ── Data-safety snapshots (Stage 1) ──
  // A full copy of every data slice at this moment (references only — cheap to build).
  const buildDataSnapshot=useCallback(()=>({
    [K.cl]:clients,[K.jo]:jobs,[K.qu]:quotes,[K.pa]:payments,[K.pr]:pricing,[K.biz]:biz,[K.no]:notes,[K.inv]:invoices,
    [K.mt]:markupTable,[K.smn]:naturalStoneMarkup,[K.sml]:labStoneMarkup,[K.csr]:centreRates,[K.ap]:appointments,
    [K.pp]:proposals,[K.td]:todos,[K.st]:stock,[K.gc]:gemCustody,[K.spot]:spotPrices,
    [K.tmt]:tradeMarkupTable,[K.tsmn]:tradeNatStoneMarkup,[K.tsml]:tradeLabStoneMarkup,
  }),[clients,jobs,quotes,payments,pricing,biz,notes,invoices,markupTable,naturalStoneMarkup,labStoneMarkup,centreRates,appointments,proposals,todos,stock,gemCustody,spotPrices,tradeMarkupTable,tradeNatStoneMarkup,tradeLabStoneMarkup]);
  // Write each slice from a snapshot back to state + cloud. Setters are stable so no deps needed.
  const applyRestore=useCallback((data)=>{
    const map={[K.cl]:setClients,[K.jo]:setJobs,[K.qu]:setQuotes,[K.pa]:setPayments,[K.pr]:setPricing,[K.biz]:setBiz,[K.no]:setNotes,[K.inv]:setInvoices,[K.mt]:setMarkupTable,[K.smn]:setNaturalStoneMarkup,[K.sml]:setLabStoneMarkup,[K.csr]:setCentreRates,[K.ap]:setAppointments,[K.pp]:setProposals,[K.td]:setTodos,[K.st]:setStock,[K.gc]:setGemCustody,[K.spot]:setSpotPrices,[K.tmt]:setTradeMarkupTable,[K.tsmn]:setTradeNatStoneMarkup,[K.tsml]:setTradeLabStoneMarkup};
    Object.entries(data||{}).forEach(([k,v])=>{const set=map[k];if(set&&v!==undefined&&v!==null){set(v);persist(k,v);}});
  },[]);
  const backupNow=useCallback(()=>cloudSnapshot(buildDataSnapshot(),"manual"),[buildDataSnapshot]);
  const restoreSnapshot=useCallback(async(entry)=>{await cloudSnapshot(buildDataSnapshot(),"before restore");applyRestore(entry.data);},[buildDataSnapshot,applyRestore]);
  // Live getter ref so the auto-snapshot timers always read current data without re-arming.
  const snapGetterRef=useRef(buildDataSnapshot);snapGetterRef.current=buildDataSnapshot;
  // Auto-snapshot: one on load (session start), then every 20 min if the data changed.
  useEffect(()=>{
    if(!storageReady||!supabaseEnabled)return;
    let lastJson=null;
    const snap=async(reason)=>{
      const get=snapGetterRef.current;if(!get)return;
      const data=get();const json=JSON.stringify(data);
      if(reason==="auto"&&json===lastJson)return;   // nothing changed since last backup
      const ts=await cloudSnapshot(data,reason);
      if(ts)lastJson=json;
    };
    const t0=setTimeout(()=>snap("session start"),5000);
    const iv=setInterval(()=>snap("auto"),1200000);
    return()=>{clearTimeout(t0);clearInterval(iv);};
  },[storageReady]);

  // ── Proposal + repair response notifications ───────────────────────────
  // Live refs so the realtime callback always sees current data (avoids stale closures).
  const proposalsRef=useRef(proposals);proposalsRef.current=proposals;
  const quotesRef=useRef(quotes);quotesRef.current=quotes;
  const jobsRef=useRef(jobs);jobsRef.current=jobs;
  const invoicesRef=useRef(invoices);invoicesRef.current=invoices;
  const [acceptToast,setAcceptToast]=useState(null);   // {title,body,jobId,color} for the live pop-up

  // Reconcile a cloud acceptance into local state: flag the proposal accepted (unseen → drives
  // the dashboard banner), approve the chosen quote, demote other approved quotes, pop a toast.
  const reconcileAccept=useCallback((row)=>{
    if(!row||row.status!=="accepted")return;
    const p=(proposalsRef.current||[]).find(x=>x.token===row.token);
    if(!p||p.status==="accepted")return;   // unknown here, or already handled
    const acceptedIds=String(row.accepted_option||"").split(",").map(s=>s.trim()).filter(Boolean);   // 1 (single) or many (multi)
    const multi=p.selectMode==="multi";
    const np=proposalsRef.current.map(x=>x.token===row.token?{...x,status:"accepted",acceptedQuoteId:row.accepted_option,acceptedName:row.accepted_name||"",acceptedAt:row.accepted_at||today(),seen:false}:x);
    setProposals(np);persist(K.pp,np);
    // Approve every accepted quote. Multi: decline the proposal's non-selected options. Single: demote other approved on the job.
    // Never demote a quote that's already on an invoice — an invoiced quote must stay Approved so totals reconcile.
    const nq=quotesRef.current.map(q=>{
      if(acceptedIds.includes(q.id))return{...q,status:"Approved"};
      if(quoteHasInvoice(invoicesRef.current,q.id))return q;
      if(multi)return (p.optionIds||[]).includes(q.id)?{...q,status:"Declined"}:q;
      return (q.jobId===p.jobId&&q.status==="Approved")?{...q,status:"Declined"}:q;
    });
    setQuotes(nq);persist(K.qu,nq);
    const labels=acceptedIds.map(id=>{const aq=quotesRef.current.find(q=>q.id===id);return aq?quoteLabel(aq):"";}).filter(Boolean).join(" + ");
    setAcceptToast({title:"Proposal accepted",color:OK,body:`${row.accepted_name||"A client"} accepted “${labels||"a proposal"}”.`,jobId:p.jobId});
  },[]);

  // Reconcile a repair accept/decline (token lives on the job, not a proposal).
  const reconcileRepairResponse=useCallback((row)=>{
    if(!row||!row.accepted_option)return;
    const job=(jobsRef.current||[]).find(j=>j.repairToken===row.token);
    if(!job||job.repairResponse)return;   // not a repair we track, or already recorded
    const declined=row.accepted_option==="declined";
    const resp={decision:row.accepted_option,name:row.accepted_name||"",at:row.accepted_at||today(),seen:false};
    // On acceptance, move the repair onto the bench so it lands in the active-work column automatically.
    const nj=jobsRef.current.map(j=>j.id===job.id?{...j,repairResponse:resp,stage:declined?j.stage:advanceToBench(j.stage)}:j);
    setJobs(nj);persist(K.jo,nj);
    setAcceptToast({title:declined?"Repair declined":"Repair accepted",color:declined?DANGER:OK,body:`${resp.name||"A client"} ${declined?"declined":"accepted"} the ${job.type||"repair"} online.`,jobId:job.id});
  },[]);

  // Mark dashboard alerts as acknowledged
  const markProposalSeen=useCallback(id=>{
    const np=(proposalsRef.current||[]).map(p=>p.id===id?{...p,seen:true}:p);
    setProposals(np);persist(K.pp,np);
  },[]);
  const markRepairSeen=useCallback(id=>{
    const nj=(jobsRef.current||[]).map(j=>j.id===id&&j.repairResponse?{...j,repairResponse:{...j.repairResponse,seen:true}}:j);
    setJobs(nj);persist(K.jo,nj);
  },[]);

  // Auto-dismiss the live toast
  useEffect(()=>{if(!acceptToast)return;const t=setTimeout(()=>setAcceptToast(null),9000);return()=>clearTimeout(t);},[acceptToast]);

  // Stop the mouse wheel from silently changing focused number inputs (e.g. a $80
  // price ticking to 79.98 when you scroll toward a button). Blurring on wheel means
  // the field keeps its typed value and the page just scrolls. Applies app-wide.
  useEffect(()=>{
    const onWheel=e=>{const el=document.activeElement;if(el&&el.tagName==="INPUT"&&el.type==="number"&&el===e.target)el.blur();};
    document.addEventListener("wheel",onWheel,{passive:true});
    return()=>document.removeEventListener("wheel",onWheel);
  },[]);

  // On load (once data is ready) batch-check every sent proposal AND every repair link for a
  // cloud response, and subscribe to realtime so responses pop instantly while the app is open.
  useEffect(()=>{
    if(!storageReady||!supabaseEnabled||!supabase)return;
    let cancelled=false;
    (async()=>{
      const sent=(proposalsRef.current||[]).filter(p=>p.status==="sent"&&p.token);
      if(sent.length){
        try{
          const{data}=await supabase.from(PUBLIC_PROPOSALS_TABLE).select("token,status,accepted_option,accepted_name,accepted_at").in("token",sent.map(p=>p.token));
          if(!cancelled&&data)data.forEach(reconcileAccept);
        }catch(e){}
      }
      const repTokens=(jobsRef.current||[]).filter(j=>j.repairToken&&!j.repairResponse).map(j=>j.repairToken);
      if(repTokens.length){
        try{
          const{data}=await supabase.from(PUBLIC_PROPOSALS_TABLE).select("token,accepted_option,accepted_name,accepted_at").in("token",repTokens);
          if(!cancelled&&data)data.forEach(reconcileRepairResponse);
        }catch(e){}
      }
    })();
    const ch=supabase.channel("public_proposals_accepts")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:PUBLIC_PROPOSALS_TABLE},payload=>{
        if(payload.new){reconcileAccept(payload.new);reconcileRepairResponse(payload.new);}
      }).subscribe();
    return()=>{cancelled=true;try{supabase.removeChannel(ch);}catch(e){}};
  },[storageReady,reconcileAccept,reconcileRepairResponse]);

  const activeNav=useMemo(()=>{
    if(view.startsWith("quoteDetail")||view==="quotes")return "quotes";
    if(view.startsWith("invoiceDetail")||view==="invoices")return "invoices";
    if(view.startsWith("newQuote")||view.startsWith("editQuote")||view.startsWith("jobDetail")||view==="jobs")return "jobs";
    if(view.startsWith("stockPrice")||view==="stock")return "stock";
    if(view==="clientDetail")return "clients";
    return view;
  },[view]);

  applyRegion(biz);   // keep currency/tax/locale current before any child renders money via fmt
  const billing=billingState(subscription);
  useEffect(()=>{setCanEdit(billing.canEdit);},[billing.canEdit]);   // gate edits when lapsed
  // After returning from Stripe Checkout (?billing=success) the webhook can take a second to land —
  // poll the studio's subscription a few times so the UI updates without a manual reload.
  useEffect(()=>{
    if(!BILLING_ENABLED||!supabase||!studioId||studioId==="none")return;
    if(new URLSearchParams(window.location.search).get("billing")!=="success")return;
    window.history.replaceState({},"",window.location.pathname);
    let n=0,stop=false;
    const poll=()=>{
      if(stop)return;
      supabase.from("studios").select("sub_status,plan,trial_ends_at,current_period_end").eq("id",studioId).maybeSingle().then(({data})=>{if(data&&!stop)setSubscription(data);}).catch(()=>{});
      if(++n<5)setTimeout(poll,2000);
    };
    poll();
    return()=>{stop=true;};
  },[studioId]);
  const render=()=>{
    if(view==="dashboard")return <Dashboard clients={clients} jobs={jobs} quotes={quotes} payments={payments} invoices={invoices} appointments={appointments} proposals={proposals} markProposalSeen={markProposalSeen} markRepairSeen={markRepairSeen} markupTable={markupTable} biz={biz} setBiz={setBiz} setView={setView} setSelClient={setSelClient} openJobs={openJobs} spotPrices={spotPrices} onUpdateSpot={()=>setSpotModal(true)}/>;
    if(view==="todo")return <TodoBoard todos={todos} setTodos={setTodos} jobs={jobs} clients={clients} setView={setView} setSelJob={setSelJob}/>;
    if(view==="appointments")return <Appointments appointments={appointments} setAppointments={setAppointments} clients={clients} setClients={setClients} jobs={jobs} setJobs={setJobs} setView={setView} setSelClient={setSelClient} setSelJob={setSelJob}/>;
    if(view==="clients")return <Clients clients={clients} setClients={setClients} jobs={jobs} payments={payments} setView={setView} setSelClient={setSelClient} quotes={quotes} biz={biz}/>;
    if(view==="clientDetail")return <ClientDetail clientId={selClient} clients={clients} setClients={setClients} jobs={jobs} setJobs={setJobs} quotes={quotes} payments={payments} invoices={invoices} markupTable={markupTable} setView={setView} setSelJob={setSelJob} biz={biz}/>;
    if(view==="jobs")return <Jobs clients={clients} jobs={jobs} setJobs={setJobs} quotes={quotes} setQuotes={setQuotes} payments={payments} setPayments={setPayments} notes={notes} setNotes={setNotes} invoices={invoices} setInvoices={setInvoices} markupTable={markupTable} setView={setView} setSelJob={setSelJob} preset={jobsPreset} onPresetDone={()=>setJobsPreset(null)} proposals={proposals} biz={biz}/>;
    if(view==="jobDetail")return <JobDetail jobId={selJob} jobs={jobs} setJobs={setJobs} clients={clients} setClients={setClients} quotes={quotes} setQuotes={setQuotes} payments={payments} setPayments={setPayments} notes={notes} setNotes={setNotes} invoices={invoices} setInvoices={setInvoices} proposals={proposals} setProposals={setProposals} biz={biz} markupTable={markupTable} pricing={pricing} setView={setView}/>;
    if(view==="quotes")return <QuotesList quotes={quotes} jobs={jobs} clients={clients} markupTable={markupTable} biz={biz} setView={setView}/>;
    if(view.startsWith("quoteDetail_"))return <QuoteDetail quoteId={view.split("_")[1]} quotes={quotes} setQuotes={setQuotes} jobs={jobs} clients={clients} biz={biz} markupTable={markupTable} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup} tradeNatStoneMarkup={tradeNatStoneMarkup} tradeLabStoneMarkup={tradeLabStoneMarkup} payments={payments} invoices={invoices} setView={setView}/>;
    if(view.startsWith("newQuote_"))return <QuoteBuilder jobId={view.split("_")[1]} jobs={jobs} clients={clients} quotes={quotes} setQuotes={setQuotes} pricing={pricing} setPricing={setPricing} markupTable={markupTable} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup} tradeMarkupTable={tradeMarkupTable} tradeNatStoneMarkup={tradeNatStoneMarkup} tradeLabStoneMarkup={tradeLabStoneMarkup} centreRates={centreRates} setCentreRates={setCentreRates} setView={setView}/>;
    if(view.startsWith("editQuote_"))return <QuoteBuilder editQuoteId={view.split("_")[1]} jobs={jobs} clients={clients} quotes={quotes} setQuotes={setQuotes} pricing={pricing} setPricing={setPricing} markupTable={markupTable} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup} tradeMarkupTable={tradeMarkupTable} tradeNatStoneMarkup={tradeNatStoneMarkup} tradeLabStoneMarkup={tradeLabStoneMarkup} centreRates={centreRates} setCentreRates={setCentreRates} invoices={invoices} setInvoices={setInvoices} setView={setView}/>;
    if(view==="invoices")return <InvoicesList invoices={invoices} jobs={jobs} clients={clients} quotes={quotes} setQuotes={setQuotes} payments={payments} setInvoices={setInvoices} markupTable={markupTable} setView={setView} biz={biz}/>;
    if(view.startsWith("invoiceDetail_"))return <InvoiceDetail invoiceId={view.split("_")[1]} invoices={invoices} setInvoices={setInvoices} jobs={jobs} clients={clients} payments={payments} biz={biz} setView={setView} quotes={quotes} markupTable={markupTable}/>;
    if(view==="statements")return <StatementsList clients={clients} jobs={jobs} invoices={invoices} payments={payments} biz={biz} setView={setView}/>;
    if(view.startsWith("statementDetail_"))return <StatementDetail clientId={view.split("_")[1]} clients={clients} jobs={jobs} invoices={invoices} payments={payments} biz={biz} setView={setView}/>;
    if(view==="stock")return <StockBoard stock={stock} setStock={setStock} setView={setView}/>;
    if(view==="gemcustody")return <GemCustody custody={gemCustody} setCustody={setGemCustody} clients={clients} biz={biz}/>;
    if(view.startsWith("stockPrice_"))return <QuoteBuilder stockId={view.split("_")[1]} stock={stock} setStock={setStock} jobs={jobs} clients={clients} quotes={quotes} setQuotes={setQuotes} pricing={pricing} setPricing={setPricing} markupTable={markupTable} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup} tradeMarkupTable={tradeMarkupTable} tradeNatStoneMarkup={tradeNatStoneMarkup} tradeLabStoneMarkup={tradeLabStoneMarkup} centreRates={centreRates} setCentreRates={setCentreRates} setView={setView}/>;
    if(view==="pricing")return <PricingDB pricing={pricing} setPricing={setPricing} spotPrices={spotPrices} setSpotPrices={setSpotPrices} markupTable={markupTable} centreRates={centreRates} setCentreRates={setCentreRates} onUpdateSpot={()=>setSpotModal(true)}/>;
    if(view==="reports")return <Reports jobs={jobs} clients={clients} quotes={quotes} payments={payments} invoices={invoices} markupTable={markupTable} setView={setView}/>;
    if(view==="settings")return <Settings biz={biz} setBiz={setBiz} markupTable={markupTable} setMarkupTable={setMarkupTable} naturalStoneMarkup={naturalStoneMarkup} setNaturalStoneMarkup={setNaturalStoneMarkup} labStoneMarkup={labStoneMarkup} setLabStoneMarkup={setLabStoneMarkup} tradeMarkupTable={tradeMarkupTable} setTradeMarkupTable={setTradeMarkupTable} tradeNatStoneMarkup={tradeNatStoneMarkup} setTradeNatStoneMarkup={setTradeNatStoneMarkup} tradeLabStoneMarkup={tradeLabStoneMarkup} setTradeLabStoneMarkup={setTradeLabStoneMarkup} dataSafety={{backupNow,loadSnapshots:listCloudSnapshots,restoreSnapshot}} billing={billing}/>;
    return null;
  };

  // Auth gate — only when Supabase is configured (cloud mode)
  if(supabaseEnabled){
    if(!authReady)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CREAM,fontFamily:"'Poppins',sans-serif",color:WG,fontSize:14}}>Loading…</div>;
    if(!session)return <Login/>;
    // Resolving which studio this user belongs to — hold before showing any data
    if(studioId===null)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CREAM,fontFamily:"'Poppins',sans-serif",color:WG,fontSize:14}}>Loading…</div>;
    // Signed in but not linked to any studio (onboarding comes in phase 2)
    if(studioId==="none")return <StudioOnboarding defaultName={session?.user?.user_metadata?.studio_name||""} onCreated={id=>{setStudioIdModule(id);setStudioId(id);}}/>;
    // Cloud load failed — block the app so stale/seed data can't be saved over good cloud data
    if(loadError)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CREAM,fontFamily:"'Poppins',sans-serif",padding:20}}>
      <div style={{maxWidth:420,textAlign:"center",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 30px",boxShadow:SHADOW}}>
        <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:17,fontWeight:800,color:INK,marginBottom:8}}>Couldn't load your data</div>
        <div style={{fontSize:13,color:WG,lineHeight:1.6,marginBottom:22}}>We couldn't reach the cloud, so the app is paused to protect your saved data from being overwritten. Check your connection and try again.</div>
        <Btn onClick={()=>{setLoadError(false);setStorageReady(false);setLoadNonce(n=>n+1);}}>Retry</Btn>
      </div>
    </div>;
    // Data still loading — hold on a spinner rather than flash seed/placeholder figures
    // (e.g. wrong "balance owing by job" for a moment before real data arrives).
    if(!storageReady)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CREAM,fontFamily:"'Poppins',sans-serif",color:WG,fontSize:14}}>Loading…</div>;
  }

  return <div style={{display:"flex",minHeight:"100vh",background:CREAM,fontFamily:"'Poppins',sans-serif"}}>
    {/* Mobile Phase 2: collapse the common multi-column inline grids to a single column below
        768px. The [style*=…] selector matches React's serialized inline style, and !important
        beats the (non-important) inline value — so no per-element edits are needed. Grids that
        start "1fr 1fr…" (2/3-col forms + most tile rows) and the 220px sidebar splits collapse;
        fixed-width data-table rows keep their columns (those get horizontal scroll in Phase 3). */}
    <style>{`
      .mainpad{padding:40px 56px}
      @media(max-width:1080px){.mainpad{padding:30px 30px}}
      @media(max-width:900px){
        [style*="grid-template-columns: 1fr 1fr 1fr"]{grid-template-columns:1fr 1fr!important}
      }
      @media(max-width:767px){
        .mainpad{padding:68px 14px 24px}
        [style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr!important}
        [style*="grid-template-columns: 220px 1fr"]{grid-template-columns:1fr!important}
      }
    `}</style>
    {/* Mobile top bar — hamburger opens the nav drawer (desktop keeps the fixed sidebar) */}
    {isMobile&&<div style={{position:"fixed",top:0,left:0,right:0,height:52,background:"#000000",display:"flex",alignItems:"center",gap:12,padding:"0 14px",zIndex:1000}}>
      <button onClick={()=>setDrawerOpen(true)} aria-label="Open menu" style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",flexDirection:"column",gap:4}}>
        {[0,1,2].map(i=><span key={i} style={{width:20,height:2,background:WHITE,display:"block",borderRadius:2}}/>)}
      </button>
      <div style={{fontSize:14,fontWeight:700,color:WHITE,letterSpacing:"0.14em",textTransform:"uppercase"}}>Workshop Pilot</div>
    </div>}
    {/* Tap-away backdrop while the drawer is open */}
    {isMobile&&drawerOpen&&<div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1001}}/>}
    <div style={isMobile
      ?{width:250,maxWidth:"85vw",background:"#000000",display:"flex",flexDirection:"column",padding:"20px 0 28px",position:"fixed",top:0,left:0,height:"100vh",overflowY:"auto",zIndex:1002,transform:drawerOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.22s ease",boxShadow:drawerOpen?"2px 0 24px rgba(0,0,0,0.45)":"none"}
      :{width:210,background:"#000000",display:"flex",flexDirection:"column",padding:"40px 0 28px",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
      <div style={{padding:"0 20px 28px",borderBottom:"1px solid rgba(255,255,255,0.06)",textAlign:"center",position:"relative"}}>
        <div style={{fontSize:17,fontWeight:700,color:WHITE,letterSpacing:"0.16em",textTransform:"uppercase",lineHeight:1.15}}>Workshop Pilot</div>
        {isMobile&&<button onClick={()=>setDrawerOpen(false)} aria-label="Close menu" style={{position:"absolute",top:-2,right:10,background:"none",border:"none",color:"rgba(255,255,255,0.55)",fontSize:26,lineHeight:1,cursor:"pointer",padding:4}}>×</button>}
      </div>
      <nav style={{padding:"16px 12px",flex:1}}>
        {NAV_GROUPS.map((g,gi)=>(
          <div key={gi} style={{marginBottom:gi<NAV_GROUPS.length-1?16:0}}>
            {g.label&&<div style={{fontSize:9,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.26)",padding:"0 12px",marginBottom:8}}>{g.label}</div>}
            {g.ids.map(id=>{
              const n=NAV_MAP[id];const active=activeNav===id;
              return <button key={id} onClick={()=>{setView(id);setDrawerOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"9px 12px",borderRadius:6,border:"none",background:active?"rgba(184,146,42,0.13)":"transparent",color:active?GOLD:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:active?700:500,cursor:"pointer",fontFamily:"inherit",textAlign:"left",letterSpacing:"0.09em",textTransform:"uppercase",marginBottom:2,transition:"background 0.12s,color 0.12s"}}
                onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="rgba(255,255,255,0.92)";}}}
                onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}}>
                <NavIcon name={id} size={17}/><span>{n.label}</span>
              </button>;
            })}
          </div>
        ))}
      </nav>
      <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        {supabaseEnabled&&session&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.7)",flexShrink:0}}>{(session.user?.email||"?").slice(0,1).toUpperCase()}</div>
          <div style={{fontSize:10.5,color:"rgba(255,255,255,0.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0,flex:1}}>{session.user?.email}</div>
        </div>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {supabaseEnabled&&session
            ?<button onClick={()=>supabase.auth.signOut()} style={{background:"none",border:"none",padding:0,color:"rgba(255,255,255,0.42)",fontSize:9.5,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>Sign out</button>
            :<span/>}
          <div style={{fontSize:9,color:"rgba(255,255,255,0.18)",letterSpacing:"0.1em",textTransform:"uppercase"}}>v0.9</div>
        </div>
      </div>
    </div>
    <div className="mainpad" style={{flex:1,width:"100%",minWidth:0,overflowX:"auto"}}>
      {billing.enabled&&(billing.lapsed||(billing.trialing&&billing.daysLeft!=null))&&<div onClick={()=>setView("settings")} style={{cursor:"pointer",marginBottom:16,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:billing.lapsed?DANGER+"12":GOLD_L,border:`1px solid ${billing.lapsed?DANGER+"66":GOLD}55`}}>
        <span style={{fontSize:18}}>{billing.lapsed?"🔒":"✨"}</span>
        <span style={{flex:1,minWidth:180,fontSize:13,fontWeight:600,color:billing.lapsed?DANGER:GOLD_D}}>
          {billing.lapsed?"Your trial has ended — your data is safe and viewable, but you'll need to subscribe to add or edit.":`${billing.daysLeft} day${billing.daysLeft===1?"":"s"} left in your free trial.`}
        </span>
        <span style={{fontSize:12,fontWeight:800,color:"#fff",background:billing.lapsed?DANGER:GOLD,borderRadius:8,padding:"7px 14px",whiteSpace:"nowrap"}}>{billing.lapsed?"Subscribe":"View plans"}</span>
      </div>}
      {storageReady&&histLen>0&&<button onClick={goBack} aria-label="Go back" style={{display:"inline-flex",alignItems:"center",gap:7,marginBottom:18,background:"none",border:`1px solid ${BD}`,borderRadius:8,padding:"7px 13px",cursor:"pointer",color:INK,fontSize:12.5,fontWeight:700,fontFamily:"inherit"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.color=GOLD;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=BD;e.currentTarget.style.color=INK;}}>← Back</button>}
      {!storageReady
        ?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300,flexDirection:"column",gap:12}}>
            <div style={{fontSize:13,color:WG}}>Loading your data…</div>
          </div>
        :<ErrorBoundary key={view} onHome={()=>setView("dashboard")}>{render()}</ErrorBoundary>}
    </div>
    {/* Update metal spot prices — app-level so the button works from the Dashboard or Pricing DB */}
    {spotModal&&<SpotPriceUpdater spotPrices={spotPrices} setSpotPrices={setSpotPrices} pricing={pricing} setPricing={setPricing} onClose={()=>setSpotModal(false)}/>}
    {/* Live response pop-up — proposals & repairs (any view) */}
    {acceptToast&&<div onClick={()=>{const j=acceptToast.jobId;setAcceptToast(null);if(j)setView("jobDetail_"+j);}}
      style={{position:"fixed",bottom:24,right:24,maxWidth:340,background:INK,color:WHITE,borderRadius:5,padding:"16px 18px",boxShadow:"0 12px 40px rgba(0,0,0,0.35)",zIndex:9999,cursor:"pointer",border:`1px solid ${(acceptToast.color||OK)}66`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{fontSize:22,lineHeight:1}}>{acceptToast.color===DANGER?"⚠️":"🎉"}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:800,color:acceptToast.color||OK,marginBottom:2}}>{acceptToast.title||"Update"}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.5}}>{acceptToast.body} Click to open the job.</div>
        </div>
        <button onClick={e=>{e.stopPropagation();setAcceptToast(null);}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:18,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
      </div>
    </div>}
  </div>;
}
