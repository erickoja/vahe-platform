import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
        fontWeight:'700',zIndex:'99999',fontFamily:"'DM Sans',sans-serif",maxWidth:'480px',textAlign:'center',
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
        fontWeight:'700',zIndex:'99999',fontFamily:"'DM Sans',sans-serif",maxWidth:'480px',textAlign:'center',
        boxShadow:'0 4px 20px rgba(0,0,0,0.3)'});
      document.body.appendChild(d);
      setTimeout(()=>d.remove(),2000);
      return true;
    };
  }
}catch(e){}

// ── Tokens ────────────────────────────────────────────────────────────────
const GOLD="#B8922A",GOLD_L="#F5EDD8",GOLD_D="#7A5F0F",INK="#141414",PARCH="#F7F7F8",WG="#8A8A8E",BD="#E6E6E8",WHITE="#FFFFFF",OK="#2D7A4F",OK_BG="#EAF5EF",DANGER="#C0392B",WARN="#B06A10";
// Monochrome (black & white) system
const CREAM="#F5F5F6";          // app background (light neutral grey)
const BD_SOFT="#ECECEE";        // softer hairline border
const RADIUS=18;                // card corner radius
const SHADOW="0 1px 2px rgba(20,20,22,0.04),0 4px 14px rgba(20,20,22,0.06)";
const SHADOW_HV="0 6px 18px rgba(20,20,22,0.10),0 16px 36px rgba(20,20,22,0.12)";
// Stat-tile treatments — neutral by default; a couple carry a functional status hint
const _NEU={bg:WHITE,ring:"#F0F0F2",fg:INK};
const TINTS={
  peach:_NEU,blue:_NEU,lilac:_NEU,mint:_NEU,gold:_NEU,
  rose:{bg:WHITE,ring:"#FBEAEA",fg:DANGER},   // overdue / alert
};

// ── Constants ─────────────────────────────────────────────────────────────
const JOB_TYPES=["Engagement ring","Wedding band","Eternity ring","Dress ring","Custom pendant","Necklace","Earrings","Bracelet","Repair","Remodelling","Grillz","Chain","Custom","Other"];
const JOB_TYPE_ICONS={"Engagement ring":"◇","Wedding band":"○","Eternity ring":"◉","Dress ring":"✧","Custom pendant":"✦","Necklace":"⌒","Earrings":"❖","Bracelet":"∞","Repair":"◆","Remodelling":"⟳","Grillz":"▦","Chain":"◈","Custom":"✶","Other":"◦"};
const JOB_STAGES=["Enquiry","Consultation","Quoted","Approved","Design / CAD","Render approval","Wax / Cast","Stone setting","Polishing / Finish","QC check","Ready for collection","Collected"];
const SC={"Enquiry":"#A0845C","Consultation":"#7A6C5D","Quoted":"#5B7FA6","Approved":"#3B6E8F","Design / CAD":"#7B5EA7","Render approval":"#9B4F96","Wax / Cast":"#B05C3A","Stone setting":"#C47A2E","Polishing / Finish":"#8B9E3A","QC check":"#4A8E6A","Ready for collection":"#2D7A4F","Collected":"#1A5C3A"};
const PAY_TYPES=["Diamond deposit","Diamond balance","Setting deposit","Deposit","CAD / Design stage","Production deposit","Progress payment","Final balance","Lay-by payment","Other"];
const PAY_METHODS=["Bank transfer","Cash","Card (EFTPOS)","Card (credit)","PayID","Cheque","Other"];
const FINDINGS_CAT="Findings";
const PURCHASED_CAT="Purchased Components";
const CENTRE_SET_CAT="Centre Stone Setting";
const REPAIRS_CAT="Repairs";
const REPAIR_GROUPS=["Cleaning & Polishing","Ring Repairs","Ring Resizing — up to 3mm wide","Ring Resizing — 3mm+ wide","Claw Re-tipping","Band Replacements","Chain Repair","Stone Setting (Repair)","Stone Tightening","Diamond Replacement"];
// Centre stone setting: fee = carat × per-ct rate (basic default $50/ct, complex default $75/ct)
const DEFAULT_CENTRE_RATES={basicPerCt:50,complexPerCt:75};
const PCAT=["Metals","Labour","CAD Design",FINDINGS_CAT,PURCHASED_CAT,"Lab Grown Diamonds | D-E","Natural diamonds G-H SI1","Natural diamonds D-E VS","Basic Setting","Complex Setting",CENTRE_SET_CAT,"3D Print & Cast","Accent Stones",REPAIRS_CAT];
const DIAMOND_CATS=["Lab Grown Diamonds | D-E","Natural diamonds G-H SI1","Natural diamonds D-E VS"];
const NOTE_TYPES=["General note","Client call","Client email","Client visit","Internal update","Approval received"];
const GST_RATE=0.10;

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

// ── Pricing seed ─────────────────────────────────────────────────────────
const SEED_SPOT={gold:105,platinum:148,silver:1.45,updatedAt:"2025-05-01"};
const SEED_PRICING=[
  {id:"p1",category:"Metals",name:"9ct yellow gold",unit:"g",baseCost:39.38,metalKey:"gold",purity:0.375},
  {id:"p2",category:"Metals",name:"18ct yellow gold",unit:"g",baseCost:78.75,metalKey:"gold",purity:0.75},
  {id:"p3",category:"Metals",name:"18ct white gold",unit:"g",baseCost:78.75,metalKey:"gold",purity:0.75},
  {id:"p4",category:"Metals",name:"18ct rose gold",unit:"g",baseCost:78.75,metalKey:"gold",purity:0.75},
  {id:"p5",category:"Metals",name:"9ct white gold",unit:"g",baseCost:39.38,metalKey:"gold",purity:0.375},
  {id:"p6",category:"Metals",name:"Platinum 950",unit:"g",baseCost:140.60,metalKey:"platinum",purity:0.95},
  {id:"p7",category:"Metals",name:"Silver 925",unit:"g",baseCost:1.34,metalKey:"silver",purity:0.925},
  {id:"p8",category:"Labour",name:"Bench Labour (Casting Assembly)",unit:"hr",baseCost:70},
  {id:"p10",category:"Labour",name:"Custom Fabrication (Handmade)",unit:"job",baseCost:320},

  {id:"p19",category:FINDINGS_CAT,name:"Lobster clasp 18ct yellow",unit:"item",baseCost:22},
  {id:"p20",category:FINDINGS_CAT,name:"Earring posts + butterflies",unit:"pair",baseCost:18},
  // ── Purchased Components (sourced chains etc.) ────────────────────────────
  {id:"p21",category:PURCHASED_CAT,name:"Box chain 18ct yellow 45cm",unit:"item",baseCost:145},
  {id:"pc10",category:PURCHASED_CAT,name:"Cable chain 9ct yellow 50cm",unit:"item",baseCost:95},
  // ── 3D Printing & Casting ─────────────────────────────────────────────────
  {id:"pc1",category:"3D Print & Cast",name:"3D print fee",unit:"piece",baseCost:60},
  {id:"pc2",category:"3D Print & Cast",name:"Casting fee",unit:"piece",baseCost:15},
  // ── CAD Design ────────────────────────────────────────────────────────────
  {id:"cad0",category:"CAD Design",name:"None (no charge)",unit:"job",baseCost:0,cadTier:true,revisions:2,additionalRate:70},
  {id:"cad1",category:"CAD Design",name:"Simple Design",unit:"job",baseCost:250,cadTier:true,revisions:2,additionalRate:70},
  {id:"cad2",category:"CAD Design",name:"Standard Design",unit:"job",baseCost:500,cadTier:true,revisions:2,additionalRate:70},
  {id:"cad3",category:"CAD Design",name:"Complex Design",unit:"job",baseCost:750,cadTier:true,revisions:2,additionalRate:70},
  {id:"cad4",category:"CAD Design",name:"Additional revision",unit:"hr",baseCost:70,cadRevision:true},
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
  {id:"rp08",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize down — Silver (≤3mm)",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp09",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~2 sizes — Silver (≤3mm)",unit:"job",baseCost:70,noMarkup:true},
  {id:"rp10",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~3 sizes — Silver (≤3mm)",unit:"job",baseCost:100,noMarkup:true},
  {id:"rp11",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Each additional size — Silver (≤3mm)",unit:"job",baseCost:35,noMarkup:true},
  {id:"rp12",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize down — 9ct Gold (≤3mm)",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp13",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~2 sizes — 9ct Gold (≤3mm)",unit:"job",baseCost:90,noMarkup:true},
  {id:"rp14",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~3 sizes — 9ct Gold (≤3mm)",unit:"job",baseCost:135,noMarkup:true},
  {id:"rp15",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Each additional size — 9ct Gold (≤3mm)",unit:"job",baseCost:45,noMarkup:true},
  {id:"rp16",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize down — 18ct Gold (≤3mm)",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp17",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~2 sizes — 18ct Gold (≤3mm)",unit:"job",baseCost:120,noMarkup:true},
  {id:"rp18",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~3 sizes — 18ct Gold (≤3mm)",unit:"job",baseCost:180,noMarkup:true},
  {id:"rp19",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Each additional size — 18ct Gold (≤3mm)",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp20",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize down — Platinum (≤3mm)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp21",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~2 sizes — Platinum (≤3mm)",unit:"job",baseCost:160,noMarkup:true},
  {id:"rp22",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Resize up ~3 sizes — Platinum (≤3mm)",unit:"job",baseCost:240,noMarkup:true},
  {id:"rp23",category:REPAIRS_CAT,group:"Ring Resizing — up to 3mm wide",name:"Each additional size — Platinum (≤3mm)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp24",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize down — Silver (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp25",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~2 sizes — Silver (3mm+)",unit:"job",baseCost:110,noMarkup:true},
  {id:"rp26",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~3 sizes — Silver (3mm+)",unit:"job",baseCost:165,noMarkup:true},
  {id:"rp27",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Each additional size — Silver (3mm+)",unit:"job",baseCost:55,noMarkup:true},
  {id:"rp28",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize down — 9ct Gold (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp29",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~2 sizes — 9ct Gold (3mm+)",unit:"job",baseCost:130,noMarkup:true},
  {id:"rp30",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~3 sizes — 9ct Gold (3mm+)",unit:"job",baseCost:195,noMarkup:true},
  {id:"rp31",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Each additional size — 9ct Gold (3mm+)",unit:"job",baseCost:65,noMarkup:true},
  {id:"rp32",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize down — 18ct Gold (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp33",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~2 sizes — 18ct Gold (3mm+)",unit:"job",baseCost:160,noMarkup:true},
  {id:"rp34",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~3 sizes — 18ct Gold (3mm+)",unit:"job",baseCost:240,noMarkup:true},
  {id:"rp35",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Each additional size — 18ct Gold (3mm+)",unit:"job",baseCost:80,noMarkup:true},
  {id:"rp36",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize down — Platinum (3mm+)",unit:"job",baseCost:100,noMarkup:true},
  {id:"rp37",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~2 sizes — Platinum (3mm+)",unit:"job",baseCost:220,noMarkup:true},
  {id:"rp38",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Resize up ~3 sizes — Platinum (3mm+)",unit:"job",baseCost:330,noMarkup:true},
  {id:"rp39",category:REPAIRS_CAT,group:"Ring Resizing — 3mm+ wide",name:"Each additional size — Platinum (3mm+)",unit:"job",baseCost:110,noMarkup:true},
  {id:"rp40",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 1 prong — 9ct Gold",unit:"job",baseCost:60,noMarkup:true},
  {id:"rp41",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 1 prong — 18ct Gold",unit:"job",baseCost:75,noMarkup:true},
  {id:"rp42",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 1 prong — Platinum",unit:"job",baseCost:90,noMarkup:true},
  {id:"rp43",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 1 prong — Silver",unit:"job",baseCost:35,noMarkup:true},
  {id:"rp44",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 6 prongs — 9ct Gold",unit:"job",baseCost:180,noMarkup:true},
  {id:"rp45",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 6 prongs — 18ct Gold",unit:"job",baseCost:225,noMarkup:true},
  {id:"rp46",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 6 prongs — Platinum",unit:"job",baseCost:270,noMarkup:true},
  {id:"rp47",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 6 prongs — Silver",unit:"job",baseCost:105,noMarkup:true},
  {id:"rp48",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 12 prongs — 9ct Gold",unit:"job",baseCost:360,noMarkup:true},
  {id:"rp49",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 12 prongs — 18ct Gold",unit:"job",baseCost:450,noMarkup:true},
  {id:"rp50",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 12 prongs — Platinum",unit:"job",baseCost:540,noMarkup:true},
  {id:"rp51",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"Re-tip 12 prongs — Silver",unit:"job",baseCost:210,noMarkup:true},
  {id:"rp52",category:REPAIRS_CAT,group:"Claw Re-tipping",name:"V-claw or double claw (each)",unit:"job",baseCost:90,noMarkup:true},
  {id:"rp53",category:REPAIRS_CAT,group:"Band Replacements",name:"1/4 shank replacement — 9ct Gold (≤3mm)",unit:"job",baseCost:250,noMarkup:true},
  {id:"rp54",category:REPAIRS_CAT,group:"Band Replacements",name:"1/4 shank replacement — 18ct Gold (≤3mm)",unit:"job",baseCost:350,noMarkup:true},
  {id:"rp55",category:REPAIRS_CAT,group:"Band Replacements",name:"1/4 shank replacement — Platinum (≤3mm)",unit:"job",baseCost:450,noMarkup:true},
  {id:"rp56",category:REPAIRS_CAT,group:"Band Replacements",name:"1/4 shank replacement — Silver (≤3mm)",unit:"job",baseCost:200,noMarkup:true},
  {id:"rp57",category:REPAIRS_CAT,group:"Band Replacements",name:"1/2 shank replacement — 9ct Gold (≤3mm)",unit:"job",baseCost:350,noMarkup:true},
  {id:"rp58",category:REPAIRS_CAT,group:"Band Replacements",name:"1/2 shank replacement — 18ct Gold (≤3mm)",unit:"job",baseCost:450,noMarkup:true},
  {id:"rp59",category:REPAIRS_CAT,group:"Band Replacements",name:"1/2 shank replacement — Platinum (≤3mm)",unit:"job",baseCost:550,noMarkup:true},
  {id:"rp60",category:REPAIRS_CAT,group:"Band Replacements",name:"1/2 shank replacement — Silver (≤3mm)",unit:"job",baseCost:250,noMarkup:true},
  {id:"rp61",category:REPAIRS_CAT,group:"Band Replacements",name:"3/4 shank replacement — 9ct Gold (≤3mm)",unit:"job",baseCost:400,noMarkup:true},
  {id:"rp62",category:REPAIRS_CAT,group:"Band Replacements",name:"3/4 shank replacement — 18ct Gold (≤3mm)",unit:"job",baseCost:500,noMarkup:true},
  {id:"rp63",category:REPAIRS_CAT,group:"Band Replacements",name:"3/4 shank replacement — Platinum (≤3mm)",unit:"job",baseCost:600,noMarkup:true},
  {id:"rp64",category:REPAIRS_CAT,group:"Band Replacements",name:"3/4 shank replacement — Silver (≤3mm)",unit:"job",baseCost:300,noMarkup:true},
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
  {id:"rps01",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 0.7mm",unit:"stone",baseCost:3.50,sizeMm:0.7,noMarkup:true},
  {id:"rps02",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 0.8mm",unit:"stone",baseCost:4.00,sizeMm:0.8,noMarkup:true},
  {id:"rps03",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 0.9mm",unit:"stone",baseCost:4.50,sizeMm:0.9,noMarkup:true},
  {id:"rps04",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.0mm",unit:"stone",baseCost:5.00,sizeMm:1.0,noMarkup:true},
  {id:"rps05",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.1mm",unit:"stone",baseCost:5.50,sizeMm:1.1,noMarkup:true},
  {id:"rps06",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.2mm",unit:"stone",baseCost:6.00,sizeMm:1.2,noMarkup:true},
  {id:"rps07",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.3mm",unit:"stone",baseCost:6.50,sizeMm:1.3,noMarkup:true},
  {id:"rps08",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.4mm",unit:"stone",baseCost:7.00,sizeMm:1.4,noMarkup:true},
  {id:"rps09",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.5mm",unit:"stone",baseCost:7.50,sizeMm:1.5,noMarkup:true},
  {id:"rps10",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.6mm",unit:"stone",baseCost:8.00,sizeMm:1.6,noMarkup:true},
  {id:"rps11",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.7mm",unit:"stone",baseCost:8.50,sizeMm:1.7,noMarkup:true},
  {id:"rps12",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.8mm",unit:"stone",baseCost:9.00,sizeMm:1.8,noMarkup:true},
  {id:"rps13",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 1.9mm",unit:"stone",baseCost:9.50,sizeMm:1.9,noMarkup:true},
  {id:"rps14",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.0mm",unit:"stone",baseCost:10.00,sizeMm:2.0,noMarkup:true},
  {id:"rps15",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.1mm",unit:"stone",baseCost:10.50,sizeMm:2.1,noMarkup:true},
  {id:"rps16",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.2mm",unit:"stone",baseCost:11.00,sizeMm:2.2,noMarkup:true},
  {id:"rps17",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.3mm",unit:"stone",baseCost:11.50,sizeMm:2.3,noMarkup:true},
  {id:"rps18",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.4mm",unit:"stone",baseCost:12.00,sizeMm:2.4,noMarkup:true},
  {id:"rps19",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.5mm",unit:"stone",baseCost:12.50,sizeMm:2.5,noMarkup:true},
  {id:"rps20",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.6mm",unit:"stone",baseCost:13.00,sizeMm:2.6,noMarkup:true},
  {id:"rps21",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.7mm",unit:"stone",baseCost:13.50,sizeMm:2.7,noMarkup:true},
  {id:"rps22",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.8mm",unit:"stone",baseCost:14.00,sizeMm:2.8,noMarkup:true},
  {id:"rps23",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 2.9mm",unit:"stone",baseCost:14.50,sizeMm:2.9,noMarkup:true},
  {id:"rps24",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.0mm",unit:"stone",baseCost:15.00,sizeMm:3.0,noMarkup:true},
  {id:"rps25",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.1mm",unit:"stone",baseCost:15.50,sizeMm:3.1,noMarkup:true},
  {id:"rps26",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.2mm",unit:"stone",baseCost:16.00,sizeMm:3.2,noMarkup:true},
  {id:"rps27",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.3mm",unit:"stone",baseCost:16.50,sizeMm:3.3,noMarkup:true},
  {id:"rps28",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.4mm",unit:"stone",baseCost:17.00,sizeMm:3.4,noMarkup:true},
  {id:"rps29",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.5mm",unit:"stone",baseCost:17.50,sizeMm:3.5,noMarkup:true},
  {id:"rps30",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.6mm",unit:"stone",baseCost:18.00,sizeMm:3.6,noMarkup:true},
  {id:"rps31",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.7mm",unit:"stone",baseCost:18.50,sizeMm:3.7,noMarkup:true},
  {id:"rps32",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.8mm",unit:"stone",baseCost:19.00,sizeMm:3.8,noMarkup:true},
  {id:"rps33",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 3.9mm",unit:"stone",baseCost:19.50,sizeMm:3.9,noMarkup:true},
  {id:"rps34",category:REPAIRS_CAT,group:"Stone Setting (Repair)",name:"Stone setting repair — 4.0mm",unit:"stone",baseCost:20.00,sizeMm:4.0,noMarkup:true},
  {id:"rst01",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 0.7mm",unit:"stone",baseCost:1.75,sizeMm:0.7,noMarkup:true},
  {id:"rst02",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 0.8mm",unit:"stone",baseCost:2.00,sizeMm:0.8,noMarkup:true},
  {id:"rst03",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 0.9mm",unit:"stone",baseCost:2.25,sizeMm:0.9,noMarkup:true},
  {id:"rst04",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.0mm",unit:"stone",baseCost:2.50,sizeMm:1.0,noMarkup:true},
  {id:"rst05",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.1mm",unit:"stone",baseCost:2.75,sizeMm:1.1,noMarkup:true},
  {id:"rst06",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.2mm",unit:"stone",baseCost:3.00,sizeMm:1.2,noMarkup:true},
  {id:"rst07",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.3mm",unit:"stone",baseCost:3.25,sizeMm:1.3,noMarkup:true},
  {id:"rst08",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.4mm",unit:"stone",baseCost:3.50,sizeMm:1.4,noMarkup:true},
  {id:"rst09",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.5mm",unit:"stone",baseCost:3.75,sizeMm:1.5,noMarkup:true},
  {id:"rst10",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.6mm",unit:"stone",baseCost:4.00,sizeMm:1.6,noMarkup:true},
  {id:"rst11",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.7mm",unit:"stone",baseCost:4.25,sizeMm:1.7,noMarkup:true},
  {id:"rst12",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.8mm",unit:"stone",baseCost:4.50,sizeMm:1.8,noMarkup:true},
  {id:"rst13",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 1.9mm",unit:"stone",baseCost:4.75,sizeMm:1.9,noMarkup:true},
  {id:"rst14",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.0mm",unit:"stone",baseCost:5.00,sizeMm:2.0,noMarkup:true},
  {id:"rst15",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.1mm",unit:"stone",baseCost:5.25,sizeMm:2.1,noMarkup:true},
  {id:"rst16",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.2mm",unit:"stone",baseCost:5.50,sizeMm:2.2,noMarkup:true},
  {id:"rst17",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.3mm",unit:"stone",baseCost:5.75,sizeMm:2.3,noMarkup:true},
  {id:"rst18",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.4mm",unit:"stone",baseCost:6.00,sizeMm:2.4,noMarkup:true},
  {id:"rst19",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.5mm",unit:"stone",baseCost:6.25,sizeMm:2.5,noMarkup:true},
  {id:"rst20",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.6mm",unit:"stone",baseCost:6.50,sizeMm:2.6,noMarkup:true},
  {id:"rst21",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.7mm",unit:"stone",baseCost:6.75,sizeMm:2.7,noMarkup:true},
  {id:"rst22",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.8mm",unit:"stone",baseCost:7.00,sizeMm:2.8,noMarkup:true},
  {id:"rst23",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 2.9mm",unit:"stone",baseCost:7.25,sizeMm:2.9,noMarkup:true},
  {id:"rst24",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.0mm",unit:"stone",baseCost:7.50,sizeMm:3.0,noMarkup:true},
  {id:"rst25",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.1mm",unit:"stone",baseCost:7.75,sizeMm:3.1,noMarkup:true},
  {id:"rst26",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.2mm",unit:"stone",baseCost:8.00,sizeMm:3.2,noMarkup:true},
  {id:"rst27",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.3mm",unit:"stone",baseCost:8.25,sizeMm:3.3,noMarkup:true},
  {id:"rst28",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.4mm",unit:"stone",baseCost:8.50,sizeMm:3.4,noMarkup:true},
  {id:"rst29",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.5mm",unit:"stone",baseCost:8.75,sizeMm:3.5,noMarkup:true},
  {id:"rst30",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.6mm",unit:"stone",baseCost:9.00,sizeMm:3.6,noMarkup:true},
  {id:"rst31",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.7mm",unit:"stone",baseCost:9.25,sizeMm:3.7,noMarkup:true},
  {id:"rst32",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.8mm",unit:"stone",baseCost:9.50,sizeMm:3.8,noMarkup:true},
  {id:"rst33",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 3.9mm",unit:"stone",baseCost:9.75,sizeMm:3.9,noMarkup:true},
  {id:"rst34",category:REPAIRS_CAT,group:"Stone Tightening",name:"Stone tightening — 4.0mm",unit:"stone",baseCost:10.00,sizeMm:4.0,noMarkup:true},
  {id:"rmd01",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 0.8mm",unit:"stone",baseCost:0.81,sizeMm:0.8,caratWeight:0.002,noMarkup:true},
  {id:"rmd02",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 0.9mm",unit:"stone",baseCost:0.92,sizeMm:0.9,caratWeight:0.003,noMarkup:true},
  {id:"rmd03",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.0mm",unit:"stone",baseCost:1.46,sizeMm:1.0,caratWeight:0.004,noMarkup:true},
  {id:"rmd04",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.1mm",unit:"stone",baseCost:1.32,sizeMm:1.1,caratWeight:0.005,noMarkup:true},
  {id:"rmd05",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.2mm",unit:"stone",baseCost:1.27,sizeMm:1.2,caratWeight:0.007,noMarkup:true},
  {id:"rmd06",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.3mm",unit:"stone",baseCost:1.37,sizeMm:1.3,caratWeight:0.009,noMarkup:true},
  {id:"rmd07",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.4mm",unit:"stone",baseCost:1.36,sizeMm:1.4,caratWeight:0.011,noMarkup:true},
  {id:"rmd08",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.5mm",unit:"stone",baseCost:2.18,sizeMm:1.5,caratWeight:0.013,noMarkup:true},
  {id:"rmd09",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.6mm",unit:"stone",baseCost:2.09,sizeMm:1.6,caratWeight:0.016,noMarkup:true},
  {id:"rmd10",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.7mm",unit:"stone",baseCost:2.45,sizeMm:1.7,caratWeight:0.019,noMarkup:true},
  {id:"rmd11",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.8mm",unit:"stone",baseCost:2.72,sizeMm:1.8,caratWeight:0.023,noMarkup:true},
  {id:"rmd12",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 1.9mm",unit:"stone",baseCost:2.52,sizeMm:1.9,caratWeight:0.027,noMarkup:true},
  {id:"rmd13",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.0mm",unit:"stone",baseCost:3.85,sizeMm:2.0,caratWeight:0.031,noMarkup:true},
  {id:"rmd14",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.1mm",unit:"stone",baseCost:2.89,sizeMm:2.1,caratWeight:0.036,noMarkup:true},
  {id:"rmd15",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.2mm",unit:"stone",baseCost:3.35,sizeMm:2.2,caratWeight:0.042,noMarkup:true},
  {id:"rmd16",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.3mm",unit:"stone",baseCost:3.88,sizeMm:2.3,caratWeight:0.047,noMarkup:true},
  {id:"rmd17",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.4mm",unit:"stone",baseCost:4.22,sizeMm:2.4,caratWeight:0.054,noMarkup:true},
  {id:"rmd18",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.5mm",unit:"stone",baseCost:4.49,sizeMm:2.5,caratWeight:0.061,noMarkup:true},
  {id:"rmd19",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.6mm",unit:"stone",baseCost:4.46,sizeMm:2.6,caratWeight:0.069,noMarkup:true},
  {id:"rmd20",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.7mm",unit:"stone",baseCost:5.43,sizeMm:2.7,caratWeight:0.077,noMarkup:true},
  {id:"rmd21",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.8mm",unit:"stone",baseCost:6.11,sizeMm:2.8,caratWeight:0.086,noMarkup:true},
  {id:"rmd22",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 2.9mm",unit:"stone",baseCost:6.72,sizeMm:2.9,caratWeight:0.095,noMarkup:true},
  {id:"rmd23",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.0mm",unit:"stone",baseCost:7.36,sizeMm:3.0,caratWeight:0.105,noMarkup:true},
  {id:"rmd24",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.1mm",unit:"stone",baseCost:11.36,sizeMm:3.1,caratWeight:0.116,noMarkup:true},
  {id:"rmd25",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.2mm",unit:"stone",baseCost:10.40,sizeMm:3.2,caratWeight:0.128,noMarkup:true},
  {id:"rmd26",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.3mm",unit:"stone",baseCost:10.00,sizeMm:3.3,caratWeight:0.140,noMarkup:true},
  {id:"rmd27",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.4mm",unit:"stone",baseCost:11.80,sizeMm:3.4,caratWeight:0.153,noMarkup:true},
  {id:"rmd28",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.5mm",unit:"stone",baseCost:16.00,sizeMm:3.5,caratWeight:0.167,noMarkup:true},
  {id:"rmd29",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.6mm",unit:"stone",baseCost:20.00,sizeMm:3.6,caratWeight:0.182,noMarkup:true},
  {id:"rmd30",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.7mm",unit:"stone",baseCost:22.00,sizeMm:3.7,caratWeight:0.198,noMarkup:true},
  {id:"rmd31",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.8mm",unit:"stone",baseCost:26.00,sizeMm:3.8,caratWeight:0.214,noMarkup:true},
  {id:"rmd32",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 3.9mm",unit:"stone",baseCost:28.00,sizeMm:3.9,caratWeight:0.231,noMarkup:true},
  {id:"rmd33",category:REPAIRS_CAT,group:"Diamond Replacement",name:"Diamond replacement — 4.0mm",unit:"stone",baseCost:30.00,sizeMm:4.0,caratWeight:0.250,noMarkup:true},
];
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
const fmt=n=>`$${Number(n||0).toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtR=n=>`$${Math.round(Number(n||0)).toLocaleString("en-AU")}`;
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>d?new Date(d).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):"—";
// ── Calendar helpers (local-time based, so "today" is correct in AU) ───────
const pad2=n=>String(n).padStart(2,"0");
const toISO=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const localToday=()=>toISO(new Date());
const parseISO=s=>{const[y,m,d]=String(s||"").split("-").map(Number);return new Date(y,(m||1)-1,d||1);};
const addDays=(s,n)=>{const d=parseISO(s);d.setDate(d.getDate()+n);return toISO(d);};
const addMonths=(s,n)=>{const d=parseISO(s);d.setMonth(d.getMonth()+n);return toISO(d);};
const startOfWeek=s=>{const d=parseISO(s);const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return toISO(d);}; // Monday
const fmtTime=t=>{if(!t)return"";const[h,m]=String(t).split(":").map(Number);if(isNaN(h))return"";const ap=h<12?"am":"pm";return`${h%12||12}:${pad2(m||0)}${ap}`;};
const fmtDayShort=s=>parseISO(s).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"});
const monthLabel=s=>parseISO(s).toLocaleDateString("en-AU",{month:"long",year:"numeric"});
const addMin=(t,min)=>{if(!t||!min)return"";const[h,m]=String(t).split(":").map(Number);if(isNaN(h))return"";const tot=h*60+m+Number(min);const hh=Math.floor((tot%1440)/60),mm=tot%60;return`${pad2(hh)}:${pad2(mm)}`;};
const APPT_TYPES=["Consultation","Engagement Ring","Wedding Ring","Custom Design","Jewellery Repair","Laser Engraving","Other"];
const APPT_COLORS={"Consultation":"#5B7FA6","Engagement Ring":"#9B4F96","Wedding Ring":"#2D7A4F","Custom Design":"#7B5EA7","Jewellery Repair":"#C47A2E","Laser Engraving":"#5E6B7A","Other":"#7A6C5D"};
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

const calcQuote=(items,table,overrideMult)=>{
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
  const markupFinal=base*mult;
  const flatTotal=fItems.reduce((s,li)=>s+lineCost(li),0);
  const hasFlatItems=fItems.length>0;
  // Round the customer-facing price (global rounding setting) — internals stay exact
  const finalLow=roundQ(markupFinal+flatTotal);
  const finalHigh=finalLow;
  const baseLow=base;const baseHigh=base;const isRange=false;
  const markupFinalLow=markupFinal;const markupFinalHigh=markupFinal;const flatHigh=flatTotal;
  return {base,baseLow,baseHigh,isRange,bracket,mult,autoMult,overridden,markupFinal,markupFinalLow,markupFinalHigh,flatTotal,flatHigh,hasFlatItems,finalLow,finalHigh};
};

// Manual quoted price (verbal phone / in-person quotes): when q.manualTotal is set (>0)
// it IS the customer price (inc GST) and replaces the calculated grand total everywhere.
const quoteIsManual=q=>Number(q?.manualTotal)>0;
// Grand total for a quote, inc GST — manual price wins; else jewellery + centre stone + stone-markup accents.
const quoteGrandTotal=(q,markupTable)=>{
  if(quoteIsManual(q))return Number(q.manualTotal);
  const c=calcQuote(q.lineItems,markupTable,q.markupOverride);
  return (c.isRange?c.finalHigh:c.finalLow)+(q.stoneClientTotal||0)+(q.accentStoneTotal||0);
};
// Total agreed charge for a job, used by every financial view.
// Uses the manual Total Charge Override when set; otherwise sums approved quotes.
const jobChargeTotal=(job,quotes,markupTable)=>{
  const ov=Number(job?.totalOverride);
  if(ov>0)return ov;
  const aq=(quotes||[]).filter(q=>q.jobId===job.id&&q.status==="Approved");
  return aq.reduce((s,q)=>s+quoteGrandTotal(q,markupTable),0);
};
// True if the job has any agreed charge (override or approved quote)
const jobHasCharge=(job,quotes)=>Number(job?.totalOverride)>0||(quotes||[]).some(q=>q.jobId===job.id&&q.status==="Approved");
// Short reference for a quote: the user's title if set, otherwise the random #ID tag
const quoteRef=q=>"#"+(q?.id||"").slice(-4).toUpperCase();
const quoteLabel=q=>(q?.title&&q.title.trim())?q.title.trim():"Quote "+quoteRef(q);

// ── Storage ───────────────────────────────────────────────────────────────
// ── Stone quote calculation (cost → markup → +GST) ───────────────────────
const calcStoneQuote=(items,table)=>{
  const stones=items.filter(i=>Number(i.cost||i.costLow)>0);
  if(!stones.length)return null;
  const totalCost=stones.reduce((s,i)=>s+Number(i.cost||i.costLow||0),0);
  const bracket=(table||[]).find(b=>totalCost>=b.low&&totalCost<=b.high)||null;
  const mult=bracket?.multiplier||1;
  // Round the final inclusive price (global rounding setting), then back out the GST
  // component so markedUp + gst still sum exactly to what the client pays.
  const clientTotal=roundQ(totalCost*mult*(1+GST_RATE));
  const gst=clientTotal-clientTotal/(1+GST_RATE);
  const markedUp=clientTotal-gst;
  return{totalCost,bracket,mult,markedUp,gst,clientTotal};
};

const K={cl:"jlr4_clients",jo:"jlr4_jobs",qu:"jlr4_quotes",pa:"jlr4_payments",pr:"jlr4_pricing_v9",biz:"jlr4_biz",no:"jlr4_notes",inv:"jlr4_invoices",spot:"jlr4_spot",mt:"jlr4_markup",smn:"jlr4_stone_nat",sml:"jlr4_stone_lab",csr:"jlr4_centre_rates",ap:"jlr4_appointments",pp:"jlr4_proposals"};

// Name of the public, anon-readable table holding immutable proposal snapshots for client links.
const PUBLIC_PROPOSALS_TABLE="public_proposals";
// Build the frozen client-facing snapshot from the chosen option quotes. Stored in the
// cloud at publish time so the client always sees exactly what was sent (no live data access).
const buildProposalSnapshot=({proposal,job,client,biz,quotes,markupTable,payments})=>{
  const validityDays=biz?.quoteValidityDays||30;
  const created=proposal.createdAt||today();
  const paidTotal=(payments||[]).filter(p=>p.jobId===job?.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const options=(proposal.optionIds||[]).map(qid=>{
    const q=quotes.find(x=>x.id===qid);
    if(!q)return null;
    const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
    const priceKnown=quoteIsManual(q)||!(calc.base>0&&!calc.bracket&&!calc.overridden);
    return{
      id:q.id,
      label:quoteLabel(q),
      price:priceKnown?quoteGrandTotal(q,markupTable):null,
      description:q.clientDescription||job?.description||"",
      recommended:proposal.recommendedId===q.id,
    };
  }).filter(Boolean);
  return{
    kind:"proposal",
    biz:{name:biz?.name||"",logo:biz?.logo||"",phone:biz?.phone||"",email:biz?.email||"",abn:biz?.abn||"",address:biz?.address||""},
    clientName:client?.name||"",
    jobType:job?.type||"Custom Jewellery",
    intro:proposal.intro||"",
    options,
    selectMode:proposal.selectMode==="multi"?"multi":"single",
    depositPercent:biz?.depositPercent||50,
    paidTotal,
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
  const balance=Math.max(0,inv.totalIncGST-paidTotal);
  const requestAmount=Number(inv.requestAmount)||0;
  const staged=requestAmount>0;
  const dueNow=staged?Math.min(requestAmount,balance):balance;
  const remainingAfter=Math.max(0,balance-dueNow);
  return{
    kind:"invoice",
    biz:{name:biz?.name||"",logo:biz?.logo||"",phone:biz?.phone||"",email:biz?.email||"",abn:biz?.abn||"",address:biz?.address||"",
      bankName:biz?.bankName||"",bankAccountName:biz?.bankAccountName||biz?.name||"",bankBSB:biz?.bankBSB||"",bankAccount:biz?.bankAccount||""},
    clientName:client?.name||"",
    number:inv.number,
    date:inv.date,
    jobType:job?.type||"",
    descriptionOverride:inv.descriptionOverride||"",
    lineItems:(inv.lineItems||[]).map(li=>({description:li.description,detail:li.detail||"",amount:lineCostLow(li)})),
    gst:inv.gst,
    totalIncGST:inv.totalIncGST,
    paidTotal,
    balance,
    staged,
    dueNow,
    remainingAfter,
    asAt:today(),
  };
};

// Snapshot of a repair intake/receipt for the public client link (kind:"repair").
// items must already carry their customer-facing clientPrice (never the trade cost).
const buildRepairSnapshot=({job,client,biz,items,instructions})=>({
  kind:"repair",
  biz:{name:biz?.name||"",logo:biz?.logo||"",phone:biz?.phone||"",email:biz?.email||"",abn:biz?.abn||"",address:biz?.address||""},
  clientName:client?.name||"",
  ref:(job?.id||"").slice(-6).toUpperCase(),
  dateIn:job?.dateIn||"",
  dateOut:job?.dateOut||"",
  items:(items||[]).map(it=>({itemType:it.itemType||"",damage:it.damage||"",condition:it.condition||"",price:Number(it.clientPrice)||0})),
  total:(items||[]).reduce((s,it)=>s+(Number(it.clientPrice)||0),0),
  instructions:instructions||"",
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
// Strict cloud read — throws on error (no silent fallback) so the loader can tell
// the difference between "no data yet" (null) and "couldn't reach the cloud" (throw).
const _cloudGet=async(k)=>{
  const{data,error}=await supabase.from(STATE_TABLE).select("value").eq("key",k).maybeSingle();
  if(error)throw error;
  return data?data.value:null;
};

const _localGet=async(k)=>{
  try{
    if(_useClaudeStorage()){
      const r=await window.storage.get(k);
      return(r&&r.value)?JSON.parse(r.value):null;
    }
    const v=localStorage.getItem(k);
    return v?JSON.parse(v):null;
  }catch(e){return null;}
};
const _localSet=(k,v)=>{
  try{
    if(_useClaudeStorage()){window.storage.set(k,JSON.stringify(v)).catch(()=>{});}
    else{localStorage.setItem(k,JSON.stringify(v));}
  }catch(e){}
};

const _storeGet=async(k)=>{
  if(_cloudActive&&supabase){
    try{
      const{data,error}=await supabase.from(STATE_TABLE).select("value").eq("key",k).maybeSingle();
      if(error)throw error;
      return data?data.value:null;
    }catch(e){return await _localGet(k);}
  }
  return await _localGet(k);
};
const persist=(k,v)=>{
  // Always keep a local copy (offline resilience + instant reloads)
  _localSet(k,v);
  if(_cloudActive&&supabase){
    // SAFETY GUARD: never push to the cloud until we've confirmed a successful
    // cloud read this session. Stops a stale/seed boot from wiping real data.
    if(!_cloudLoaded){console.warn("Skipped cloud save for",k,"— cloud not loaded yet");return;}
    supabase.from(STATE_TABLE).upsert({key:k,value:v,updated_at:new Date().toISOString()},{onConflict:"key"}).then(({error})=>{
      if(error)console.warn("Cloud save failed for",k,error.message);
    });
  }
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
  const path=`${jobId}/${uid()}.jpg`;
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

// ── Shared UI ─────────────────────────────────────────────────────────────
const SS={inp:{width:"100%",padding:"10px 13px",borderRadius:10,border:`1px solid ${BD}`,fontSize:13,fontFamily:"inherit",color:INK,background:WHITE,outline:"none",boxSizing:"border-box",marginTop:4},lbl:{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.1em",textTransform:"uppercase",display:"block"}};


function StoneMarkupSummary({calc}){
  if(!calc)return null;
  if(!calc.bracket)return <div style={{background:"#FFF3CD",border:"1px solid #F0C040",borderRadius:6,padding:"12px 16px",fontSize:13,color:WARN}}>Stone cost is outside your stone markup table range — check your table in Settings.</div>;
  return <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:8,overflow:"hidden"}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",borderBottom:`1px solid ${BD}`}}>
      {[
        ["Your cost",fmt(calc.totalCost),WG],
        ["Bracket",calc.bracket?`${fmt(calc.bracket.low)}–${fmt(calc.bracket.high)}`:"—",WG],
        ["Markup",`${calc.mult}×`,"#7B5EA7"],
        ["Marked up",fmt(calc.markedUp),INK],
        ["+ GST → Client",fmtR(calc.clientTotal),OK],
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
        <span style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Your profit on this stone <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(internal — excl. GST)</span></span>
        <span style={{fontSize:13,color:INK}}><strong style={{color:OK,fontSize:15}}>{fmt(profit)}</strong> profit · <strong style={{color:INK}}>{margin}%</strong> margin · {calc.mult}× markup</span>
      </div>;
    })()}
    <div style={{padding:"8px 14px",fontSize:11,color:WG}}>Stone price shown to client: <strong style={{color:INK}}>{fmtR(calc.clientTotal)}</strong> (your cost {fmt(calc.totalCost)} × {calc.mult} markup = {fmt(calc.markedUp)} + 10% GST)</div>
  </div>;
}

function Badge({label,color=WG,size="sm"}){
  return <span style={{display:"inline-block",padding:size==="lg"?"4px 14px":"2px 9px",borderRadius:20,fontSize:size==="lg"?12:11,fontWeight:700,letterSpacing:"0.04em",background:color+"22",color,border:`1px solid ${color}44`,whiteSpace:"nowrap"}}>{label}</span>;
}
function Btn({onClick,children,sm,danger,ghost,disabled}){
  const[h,setH]=useState(false);
  const bg=disabled?"#D6D6D8":danger?(h?"#9A2D22":DANGER):ghost?(h?"#EFEFF1":"transparent"):(h?"#000000":INK);
  const fg=ghost?(h?INK:WG):WHITE;
  const shadow=disabled||ghost?"none":h?(danger?"0 4px 12px rgba(192,57,43,0.28)":"0 4px 12px rgba(20,20,22,0.28)"):(danger?"0 2px 6px rgba(192,57,43,0.20)":"0 2px 6px rgba(20,20,22,0.20)");
  return <button onClick={disabled?undefined:onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} disabled={disabled}
    style={{background:bg,color:fg,border:ghost?`1px solid ${BD}`:"none",borderRadius:999,padding:sm?"6px 15px":"10px 22px",fontSize:sm?12:14,fontWeight:700,cursor:disabled?"default":"pointer",fontFamily:"inherit",letterSpacing:"0.01em",transition:"all 0.15s",opacity:disabled?0.6:1,boxShadow:shadow,transform:h&&!disabled?"translateY(-1px)":"none"}}>{children}</button>;
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
function Modal({title,onClose,children,wide}){
  return <div style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(3px)"}}>
    <div style={{background:WHITE,borderRadius:4,padding:"30px 34px",width:"100%",maxWidth:wide?860:580,maxHeight:"92vh",overflowY:"auto",border:`1px solid ${BD}`,boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <h2 style={{margin:0,fontSize:19,fontWeight:800,color:INK}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:WG,lineHeight:1,padding:0}}>×</button>
      </div>
      {children}
    </div>
  </div>;
}
function SectionHeader({title,action}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
    <h2 style={{margin:0,fontSize:22,fontWeight:800,color:INK,letterSpacing:"-0.02em"}}>{title}</h2>
    {action}
  </div>;
}
function Stat({label,value,accent,sub,onClick,tint,icon}){
  const[h,setH]=useState(false);
  const t=tint?TINTS[tint]:null;
  return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{background:t?t.bg:WHITE,border:`1px solid ${t?"transparent":(accent?GOLD+"66":BD_SOFT)}`,borderRadius:RADIUS,padding:"18px 20px",cursor:onClick?"pointer":"default",transition:"all 0.18s",boxShadow:h?SHADOW_HV:SHADOW,transform:onClick&&h?"translateY(-2px)":"none"}}>
    {icon&&<div style={{width:40,height:40,borderRadius:13,background:t?t.ring:GOLD_L,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,marginBottom:14,color:t?t.fg:GOLD_D}}>{icon}</div>}
    <div style={{fontSize:27,fontWeight:800,color:t?t.fg:(accent?GOLD:INK),letterSpacing:"-0.02em",lineHeight:1.1}}>{value}</div>
    <div style={{fontSize:11,color:t?t.fg:WG,opacity:t?0.85:1,fontWeight:700,marginTop:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    {sub&&<div style={{fontSize:11,color:t?t.fg:WG,opacity:t?0.7:1,marginTop:2}}>{sub}</div>}
  </div>;
}

// ── Markup summary box (reused in builder + detail) ───────────────────────
function MarkupSummary({baseLow,baseHigh,isRange,bracket,mult,autoMult,overridden,markupFinalLow,markupFinalHigh,flatTotal,flatHigh,hasFlatItems,finalLow,finalHigh,large}){
  // Backwards compat: if markupFinalLow not passed, use finalLow (old call sites)
  const mfLow=markupFinalLow!==undefined?markupFinalLow:finalLow;
  const mfHigh=markupFinalHigh!==undefined?markupFinalHigh:finalHigh;
  const hasFlat=hasFlatItems&&flatTotal>0;
  // No bracket AND no manual override = genuinely can't price → warn.
  if(!bracket&&!overridden&&baseLow>0)return <div style={{background:"#FFF3CD",border:"1px solid #F0C040",borderRadius:10,padding:"12px 16px",fontSize:13,color:WARN}}>Base cost is outside your markup table range — set a manual markup multiplier below, or check your table in Settings.</div>;
  if(!bracket&&!overridden&&baseLow===0&&!hasFlat)return null;
  return <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:8,overflow:"hidden"}}>
    <div style={{display:"grid",gridTemplateColumns:hasFlat?"1fr 1fr 1fr 1fr 1fr":"1fr 1fr 1fr 1fr",borderBottom:hasFlat?`1px solid ${BD}`:"none"}}>
      {[
        ["Base cost",baseLow>0?fmt(baseLow):"—",WG],
        ["Bracket",bracket?`${fmt(bracket.low)} – ${fmt(bracket.high)}`:"—",WG],
        ["Multiplier",(bracket||overridden)?`${mult}×${overridden?" (override)":""}`:"—",overridden?GOLD:GOLD_D],
        ["Markup total",baseLow>0?fmtR(mfLow):"—",hasFlat?INK:OK],
        ...(hasFlat?[["+ Flat fees",fmt(flatTotal),"#7B5EA7"]]:
          []),
      ].map(([l,v,col])=>(
        <div key={l} style={{padding:"14px 16px",borderRight:`1px solid ${BD}`}}>
          <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{l}</div>
          <div style={{fontSize:large?18:15,fontWeight:800,color:col,letterSpacing:"-0.01em"}}>{v}</div>
        </div>
      ))}
    </div>
    {/* Profit / margin on the marked-up jewellery — internal only. The multiplier bakes in GST,
        so we back it out for a true profit; no-markup (flat) items are pass-through and excluded. */}
    {baseLow>0&&(bracket||overridden)&&(()=>{
      const exGstSell=mfLow/(1+GST_RATE);              // ex-GST value of the marked-up portion
      const profit=exGstSell-baseLow;
      const margin=exGstSell>0?Math.round(profit/exGstSell*100):0;
      return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 16px",background:OK+"0E",borderTop:`1px solid ${BD}`}}>
        <span style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>Your profit on the jewellery <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(internal — excl. GST{hasFlat?"; no-markup items at cost":""})</span></span>
        <span style={{fontSize:13,color:INK}}><strong style={{color:OK,fontSize:15}}>{fmt(profit)}</strong> profit · <strong style={{color:INK}}>{margin}%</strong> margin · {mult}× markup</span>
      </div>;
    })()}
    {hasFlat&&<div style={{display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center",padding:"12px 16px",background:WHITE,gap:12}}>
      <div style={{fontSize:11,color:WG}}>
        Markup total <strong style={{color:INK}}>{fmtR(mfLow)}</strong> + flat fees <strong style={{color:"#7B5EA7"}}>{fmt(flatTotal)}</strong>
      </div>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Setting total</div>
        <div style={{fontSize:large?22:18,fontWeight:800,color:OK}}>{fmtR(finalLow)}</div>
      </div>
    </div>}
  </div>;
}

// ── Print CSS ─────────────────────────────────────────────────────────────
const PCSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;color:#1A1714;background:#fff;padding:48px 56px;max-width:820px;margin:0 auto}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:20px;border-bottom:2.5px solid #C9A84C}.bname{font-size:22px;font-weight:700}.bsub{font-size:12px;color:#6B6560;margin-top:3px}.qlbl{font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:.12em;text-transform:uppercase;text-align:right}.qnum{font-size:26px;font-weight:800;text-align:right}.to{margin-bottom:28px}.tolbl{font-size:10px;font-weight:700;color:#6B6560;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}.toname{font-size:17px;font-weight:700}.todet{font-size:12px;color:#6B6560;margin-top:2px}.desc-box{font-size:13px;line-height:1.7;margin-bottom:26px;padding:13px 17px;background:#FAF7F2;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{font-size:10px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.05em;padding:7px 0;border-bottom:2px solid #E8E2D9;text-align:left}td{padding:8px 0;font-size:12px;border-bottom:1px solid #E8E2D9}.right{text-align:right}.muted{color:#6B6560}.cost-summary{background:#FAF7F2;border:1px solid #E8E2D9;border-radius:10px;padding:16px 20px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}.cs-item{}.cs-lbl{font-size:9px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.cs-val{font-size:15px;font-weight:800;color:#1A1714}.cs-val.gold{color:#8B6914}.cs-val.green{color:#2D7A4F}.notes{font-size:12px;color:#6B6560;font-style:italic;padding:13px 17px;background:#FAF7F2;border-radius:8px;margin-bottom:20px;line-height:1.6}.valid{font-size:11px;color:#6B6560;margin-bottom:32px}.approval{border:1px solid #E8E2D9;border-radius:10px;padding:18px 22px;margin-top:32px}.aplbl{font-size:10px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}.apbody{font-size:12px;color:#6B6560;margin-bottom:16px;line-height:1.6}.sigrow{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:12px}.sigline{border-bottom:1px solid #1A1714;margin-top:26px;margin-bottom:4px}.siglbl{font-size:10px;color:#6B6560}.footer{margin-top:40px;padding-top:13px;border-top:1px solid #E8E2D9;font-size:10px;color:#6B6560;text-align:center}@media print{body{padding:28px 36px}}`;

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
<div class="to"><div class="tolbl">Prepared for</div><div class="toname">${c?.name||"Client"}</div><div class="todet">${[c?.email,c?.phone].filter(Boolean).join(" · ")}</div></div>
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
<div class="footer">${biz.name||"Your Jewellery Studio"}${biz.abn?" · ABN "+biz.abn:""}</div>
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
function printRepairIntake(biz,c,job){
  const win=window.open("","_blank");
  const intake=job.intake||{};
  const items=intakeItems(intake);
  const ref=job.id.slice(-6).toUpperCase();
  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const ml=s=>esc(s).replace(/\n/g,"<br>");
  // Customer-facing price (set price, or cost already marked up) — never the raw trade cost.
  const itemAmt=it=>it.clientPrice!=null?Number(it.clientPrice):(Number(it.price)||0);
  const repairTotal=items.reduce((s,it)=>s+itemAmt(it),0);
  const hasPrices=repairTotal>0;
  const dash=`<span style="color:#bbb">—</span>`;

  // Top summary strip — the facts the customer cares about
  const sum=[
    ["Client",esc(c?.name||"—")],
    ["Taken in",job.dateIn?fmtDate(job.dateIn):"—"],
    ["Ready for collection",job.dateOut?fmtDate(job.dateOut):"—"],
    ...(hasPrices?[["Repair total · inc GST",`<span style="color:#8B6914">${fmt(repairTotal)}</span>`]]:[]),
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
${hasPrices?`<div class="rtot"><span class="rt-l">Repair total (inc GST)</span><span class="rt-v">${fmt(repairTotal)}</span></div>`:""}`;

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
@media print{.itbl tr{page-break-inside:avoid}}
</style></head><body>
<div class="hdr">
  <div>${biz.logo?`<img src="${biz.logo}" alt="${esc(biz.name||"Logo")}" style="max-width:180px;max-height:64px;object-fit:contain;display:block;margin-bottom:6px"/>`:`<div class="bname">${esc(biz.name||"Your Jewellery Studio")}</div>`}<div class="bsub">${[biz.email,biz.phone].filter(Boolean).map(esc).join(" · ")}</div></div>
  <div><div class="qlbl">Repair Receipt</div><div class="qnum">#${ref}</div><div style="font-size:11px;color:#6B6560;text-align:right;margin-top:3px">${fmtDate(today())}</div></div>
</div>
${summaryHtml}
${items.length>1?`<div style="font-size:10px;font-weight:700;color:#6B6560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">${items.length} items received in this drop-off</div>`:""}
${itemsHtml}
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
<div class="footer">${esc(biz.name||"Your Jewellery Studio")}${biz.abn?" · ABN "+esc(biz.abn):""}</div>
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
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#6B6560;padding:4px 0"><span>Subtotal (ex GST)</span><span>${fmt(inv.exGST)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#6B6560;padding:4px 0"><span>GST (10%)</span><span>${fmt(inv.gst)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:800;border-top:2px solid #1A1714;margin-top:6px;padding-top:8px"><span>Total inc GST</span><span>${fmt(inv.totalIncGST)}</span></div>
  </div>
</div>
${inv.notes?`<div class="notes">${inv.notes}</div>`:""}
<div class="valid">Payment due within 7 days. Thank you for your business.</div>
<div class="footer">${biz.name||"Your Jewellery Studio"}${biz.abn?" · ABN "+biz.abn:""}</div>
</body></html>`);
  win.document.close();setTimeout(()=>win.print(),400);
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({clients,jobs,quotes,payments,invoices,appointments=[],proposals=[],markProposalSeen,markRepairSeen,markupTable,setView,setSelClient}){
  // Proposals a client accepted that haven't been acknowledged yet → dashboard alert
  const acceptedUnseen=proposals.filter(p=>p.status==="accepted"&&p.seen===false);
  // Repair links a client accepted/declined that haven't been acknowledged yet
  const repairUnseen=jobs.filter(j=>j.repairResponse&&j.repairResponse.seen===false);
  const active=jobs.filter(j=>j.stage!=="Collected");
  const tISO=localToday();
  const upcomingAppts=[...appointments].filter(a=>(!a.status||a.status==="Scheduled")&&a.date>=tISO).sort((a,b)=>String(a.date+(a.time||"")).localeCompare(String(b.date+(b.time||"")))).slice(0,6);
  const todaysAppts=appointments.filter(a=>a.date===tISO&&(!a.status||a.status==="Scheduled"));
  const ready=jobs.filter(j=>j.stage==="Ready for collection");
  const overdue=active.filter(j=>j.deadline&&j.deadline<today());
  const thisMonth=new Date().toISOString().slice(0,7);
  // Cash-received view: actual payments received this month (deposits included), regardless of invoicing
  const monthReceived=payments.filter(p=>p.status==="Received"&&p.date?.startsWith(thisMonth)).reduce((s,p)=>s+Number(p.amount),0);
  const balanceOwing=jobs.map(j=>{
    if(!jobHasCharge(j,quotes))return null;
    const total=jobChargeTotal(j,quotes,markupTable);
    const paid=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
    const bal=total-paid;
    return bal>1?{job:j,balance:bal}:null;
  }).filter(Boolean);
  // Outstanding = total still owed across approved jobs (quote total − payments received)
  const outstanding=balanceOwing.reduce((s,b)=>s+b.balance,0);

  return <div>
    {/* Accepted-proposal alerts */}
    {acceptedUnseen.map(p=>{
      const job=jobs.find(j=>j.id===p.jobId);
      const cl=job?clients.find(x=>x.id===job.clientId):null;
      const labels=String(p.acceptedQuoteId||"").split(",").map(s=>s.trim()).filter(Boolean).map(id=>{const aq=quotes.find(x=>x.id===id);return aq?quoteLabel(aq):"";}).filter(Boolean).join(" + ");
      return <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,background:OK+"10",border:`1px solid ${OK}55`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
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
      return <div key={job.id} style={{display:"flex",alignItems:"center",gap:14,background:(acc?OK:DANGER)+"10",border:`1px solid ${(acc?OK:DANGER)}55`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
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
      <h1 style={{margin:0,fontSize:32,fontWeight:500,color:INK,letterSpacing:"-0.01em",fontFamily:"'DM Sans',sans-serif"}}>{(()=>{const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";})()}</h1>
      <div style={{color:WG,fontSize:14,marginTop:4}}>{fmtDate(today())}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:24}}>
      <Stat label="Today's appts" value={todaysAppts.length} sub={todaysAppts.length>0?fmtTime(todaysAppts.slice().sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")))[0].time)+" first":"none today"} tint="blue" icon="◷" onClick={()=>setView("appointments")}/>
      <Stat label="Clients" value={clients.length} tint="blue" icon="♦" onClick={()=>setView("clients")}/>
      <Stat label="Active jobs" value={active.length} tint="lilac" icon="✦" onClick={()=>setView("jobs")}/>
      <Stat label="This month" value={fmt(monthReceived)} sub="payments received" tint="mint" icon="↑"/>
      <Stat label="Outstanding" value={fmt(outstanding)} sub="balance owed" tint={outstanding>0?"peach":"mint"} icon="$"/>
      <Stat label="Ready to collect" value={ready.length} tint="gold" icon="✓" onClick={()=>setView("jobs")}/>
      <Stat label="Overdue" value={overdue.length} tint={overdue.length>0?"rose":"mint"} icon="!" onClick={()=>setView("jobs")}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.6fr) minmax(0,1fr)",gap:16,alignItems:"start"}}>
      <Card style={{marginBottom:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontWeight:700,fontSize:15,color:INK}}>Active jobs</span>
          <Btn sm ghost onClick={()=>setView("jobs")}>View all</Btn>
        </div>
        {active.length===0&&<div style={{color:WG,fontSize:14}}>No active jobs.</div>}
        {active.slice(0,8).map(j=>{
          const c=clients.find(x=>x.id===j.clientId);
          const od=j.deadline&&j.deadline<today();
          return <div key={j.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${BD}`}}>
            <div><div style={{fontWeight:600,fontSize:13,color:INK}}>{j.type} <span style={{color:WG,fontWeight:400}}>· {c?.name}</span></div>
            <div style={{fontSize:12,color:od?DANGER:WG,marginTop:1}}>Due {fmtDate(j.deadline)}{od?" — OVERDUE":""}</div></div>
            <Badge label={j.stage} color={SC[j.stage]||WG}/>
          </div>;
        })}
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <Card style={{marginBottom:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontWeight:700,fontSize:15,color:INK}}>Upcoming appointments</span>
            <Btn sm ghost onClick={()=>setView("appointments")}>View all</Btn>
          </div>
          {upcomingAppts.length===0&&<div style={{color:WG,fontSize:14}}>None scheduled.</div>}
          {upcomingAppts.map(a=>{
            const col=APPT_COLORS[a.type]||GOLD;const c=a.clientId&&clients.find(x=>x.id===a.clientId);
            return <div key={a.id} onClick={c?()=>{setSelClient&&setSelClient(a.clientId);setView("clientDetail");}:()=>setView("appointments")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${BD}`,cursor:"pointer"}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{apptName(a,clients)} <span style={{color:WG,fontWeight:400}}>· {a.type}</span></div>
                <div style={{fontSize:12,color:a.date===tISO?GOLD:WG,marginTop:1}}>{a.date===tISO?"Today":fmtDayShort(a.date)}{a.time?` · ${fmtTime(a.time)}`:""}</div>
              </div>
              <span style={{width:8,height:8,borderRadius:"50%",background:col,flexShrink:0,marginLeft:10}}/>
            </div>;
          })}
        </Card>
        {balanceOwing.length>0&&<Card style={{marginBottom:0}}>
          <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Balance owing by job</div>
          {balanceOwing.map(({job,balance})=>{
            const c=clients.find(x=>x.id===job.clientId);
            return <div key={job.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${BD}`}}>
              <div><div style={{fontWeight:600,fontSize:13,color:INK}}>{job.type} · {c?.name}</div><div style={{fontSize:12,color:WG}}>{job.stage}</div></div>
              <div style={{fontWeight:800,fontSize:15,color:WARN}}>{fmt(balance)} owing</div>
            </div>;
          })}
        </Card>}
        <Card style={{marginBottom:0}}>
          <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Anniversary reminders</div>
          {clients.filter(c=>c.anniversary).length===0?<div style={{color:WG,fontSize:14}}>None recorded.</div>
          :clients.filter(c=>c.anniversary).sort((a,b)=>a.anniversary.slice(5).localeCompare(b.anniversary.slice(5))).map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${BD}`,fontSize:13}}>
              <span style={{fontWeight:600,color:INK}}>{c.name}</span><span style={{color:WG}}>{fmtDate(c.anniversary)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  </div>;
}

// ── Clients ───────────────────────────────────────────────────────────────
function ClientForm({initial={},onSave,onCancel}){
  const[f,setF]=useState({name:"",email:"",phone:"",street:"",city:"",state:"",postcode:"",notes:"",...initial});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label="Full name" value={f.name} onChange={set("name")} placeholder="Sarah Mitchell"/>
      <Input label="Phone" value={f.phone} onChange={set("phone")} placeholder="0412 345 678"/>
      <Input label="Email" value={f.email} onChange={set("email")} placeholder="sarah@example.com"/>
    </div>
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
      <Btn onClick={()=>{if(!f.name.trim())return alert("Name required");onSave(f);}}>Save client</Btn>
    </div>
  </div>;
}

function Clients({clients,setClients,jobs,payments,setView,setSelClient}){
  const[modal,setModal]=useState(null);
  const[search,setSearch]=useState("");
  const filtered=clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.email.toLowerCase().includes(search.toLowerCase()));
  const save_=(f,id)=>{setClients(p=>{const n=id?p.map(c=>c.id===id?{...c,...f}:c):[...p,{...f,id:uid(),createdAt:today()}];persist(K.cl,n);return n;});setModal(null);};
  const del=id=>{
    const jobCount=jobs.filter(j=>j.clientId===id).length;
    const msg=jobCount>0
      ?`This client has ${jobCount} job${jobCount!==1?"s":""}. Deleting the client will leave ${jobCount!==1?"those jobs":"that job"} without an owner. Delete anyway?`
      :"Delete this client?";
    if(!confirm(msg))return;
    setClients(p=>{const n=p.filter(c=>c.id!==id);persist(K.cl,n);return n;});
  };
  return <div>
    <SectionHeader title="Clients" action={<Btn onClick={()=>setModal("add")}>+ Add client</Btn>}/>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email…" style={{...SS.inp,marginBottom:16,marginTop:0}}/>
    {filtered.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"14px 0"}}>No clients found.</div></Card>}
    {filtered.map(c=>{
      const cj=jobs.filter(j=>j.clientId===c.id);
      const spent=cj.flatMap(j=>payments.filter(p=>p.jobId===j.id&&p.status==="Received")).reduce((s,p)=>s+Number(p.amount),0);
      return <Card key={c.id} onClick={()=>{setSelClient(c.id);setView("clientDetail");}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start",flex:1}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:GOLD_L,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:GOLD_D,flexShrink:0}}>{c.name.charAt(0)}</div>
            <div><div style={{fontWeight:700,fontSize:15,color:INK}}>{c.name}</div>
            <div style={{fontSize:12,color:WG,marginTop:2}}>{c.email} · {c.phone}</div>
            <div style={{display:"flex",gap:12,fontSize:12,color:WG,marginTop:4,flexWrap:"wrap"}}>
              {spent>0&&<span>Paid: <b style={{color:OK}}>{fmt(spent)}</b></span>}
            </div></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <Badge label={`${cj.length} job${cj.length!==1?"s":""}`} color={WG}/>
            <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
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

function ClientDetail({clientId,clients,setClients,jobs,setJobs,quotes,payments,markupTable,setView,setSelJob}){
  const c=clients.find(x=>x.id===clientId);
  const[jobModal,setJobModal]=useState(false);
  const[editModal,setEditModal]=useState(false);
  const saveClient=f=>{setClients(p=>{const n=p.map(x=>x.id===clientId?{...x,...f}:x);persist(K.cl,n);return n;});setEditModal(false);};
  if(!c)return null;
  const addJob=f=>{const id=uid();setJobs(p=>{const n=[...p,{...f,id,createdAt:today()}];persist(K.jo,n);return n;});setJobModal(false);setSelJob(id);setView("jobDetail");};
  const cj=jobs.filter(j=>j.clientId===clientId);
  const spent=cj.flatMap(j=>payments.filter(p=>p.jobId===j.id&&p.status==="Received")).reduce((s,p)=>s+Number(p.amount),0);
  const charged=cj.reduce((s,j)=>s+jobChargeTotal(j,quotes,markupTable),0);
  const owing=Math.max(0,charged-spent);
  return <div>
    <button onClick={()=>setView("clients")} style={{background:"none",border:"none",cursor:"pointer",color:GOLD,fontSize:13,fontWeight:700,fontFamily:"inherit",marginBottom:18,padding:0}}>← Back to clients</button>
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
      <div style={{width:50,height:50,borderRadius:"50%",background:GOLD_L,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:GOLD_D}}>{c.name.charAt(0)}</div>
      <div style={{flex:1}}><h1 style={{margin:0,fontSize:24,fontWeight:800,color:INK,letterSpacing:"-0.02em"}}>{c.name}</h1>
      <div style={{fontSize:13,color:WG}}>Since {fmtDate(c.createdAt)} · {fmt(spent)} paid to date</div></div>
      <Btn sm ghost onClick={()=>setEditModal(true)}>✎ Edit client</Btn>
    </div>
    {charged>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
      {[["Total charged",fmt(charged),INK],["Paid",fmt(spent),OK],["Outstanding",fmt(owing),owing>0.5?WARN:OK]].map(([l,v,col])=>(
        <div key={l} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:14,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
          <div style={{fontSize:20,fontWeight:800,color:col,marginTop:3}}>{v}</div>
        </div>
      ))}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
      <Card style={{margin:0}}>
        <div style={SS.lbl}>Contact</div>
        {[["Email",c.email],["Phone",c.phone],["Address",c.street?[c.street,c.city,c.state,c.postcode].filter(Boolean).join(", "):(c.address||"")],["Client since",fmtDate(c.createdAt)]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"7px 0",borderBottom:`1px solid ${BD}`}}><span style={{color:WG}}>{k}</span><span style={{color:INK,fontWeight:600}}>{v||"—"}</span></div>
        ))}
      </Card>
      <Card style={{margin:0}}>
        <div style={SS.lbl}>Preferences</div>
        <div style={{fontSize:13,color:WG,padding:"7px 0"}}>—</div>
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
          <div><div style={{fontWeight:600,fontSize:14,color:INK}}>{j.type}</div><div style={{fontSize:12,color:WG,marginTop:2}}>Due {fmtDate(j.deadline)}</div></div>
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
  const[f,setF]=useState({clientId:"",type:JOB_TYPES[0],stage:JOB_STAGES[0],description:"",deadline:"",dateIn:"",dateOut:"",notes:"",supplier:"",supplierRef:"",totalOverride:"",...initial});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return <div>
    <Input label="Client" value={f.clientId} onChange={set("clientId")} as="select" options={[{value:"",label:"— Select a client —"},...clients.map(c=>({value:c.id,label:c.name}))]}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
      <Input label="Job type" value={f.type} onChange={set("type")} as="select" options={JOB_TYPES}/>
      <Input label="Stage" value={f.stage} onChange={set("stage")} as="select" options={JOB_STAGES}/>
      <Input label="Due date" value={f.deadline} onChange={set("deadline")} type="date"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label="Date taken in" value={f.dateIn} onChange={set("dateIn")} type="date"/>
      <Input label="Date of pickup / collection" value={f.dateOut} onChange={set("dateOut")} type="date"/>
    </div>
    <div style={{borderTop:`1px solid ${BD}`,margin:"6px 0 16px"}}/>
    <div style={{background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
      <Input label="Total charge override ($) — optional" value={f.totalOverride||""} onChange={set("totalOverride")} type="number" min="0" step="0.01" placeholder="e.g. 4500"/>
      <div style={{fontSize:11,color:GOLD_D,marginTop:-6,lineHeight:1.5}}>Set this when the sale was agreed outside the CRM (no quote needed). The CRM uses it as the job's total for balances, overview &amp; reports. Leave blank to use approved quotes instead.</div>
    </div>
    <Input label="Job description" value={f.description} onChange={set("description")} as="textarea" rows={3} placeholder="Describe the piece, specifications, materials…"/>
    <div style={{marginBottom:14}}>
      <label style={{...SS.lbl,marginBottom:6}}>Internal notes <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(not visible to client)</span></label>
      <textarea value={f.notes} onChange={e=>set("notes")(e.target.value)} rows={2} style={{...SS.inp,marginTop:0,resize:"vertical"}}/>
    </div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn ghost onClick={onCancel}>Cancel</Btn>
      <Btn onClick={()=>{if(!f.clientId)return alert("Select a client");onSave(f);}}>Save job</Btn>
    </div>
  </div>;
}

function Jobs({clients,jobs,setJobs,quotes,setQuotes,payments,setPayments,notes,setNotes,invoices,setInvoices,markupTable,setView,setSelJob}){
  const[modal,setModal]=useState(null);
  const[sf,setSf]=useState("All");
  const[tf,setTf]=useState("All");
  const[search,setSearch]=useState("");
  const typeCounts=useMemo(()=>{const m={};jobs.forEach(j=>{m[j.type]=(m[j.type]||0)+1;});return m;},[jobs]);
  const typesByCount=useMemo(()=>Object.keys(typeCounts).sort((a,b)=>typeCounts[b]-typeCounts[a]),[typeCounts]);
  const q=search.trim().toLowerCase();
  const filtered=jobs.filter(j=>{
    if(sf!=="All"&&j.stage!==sf)return false;
    if(tf!=="All"&&j.type!==tf)return false;
    if(q){
      const c=clients.find(x=>x.id===j.clientId);
      const hay=`${j.type} ${c?.name||""} ${j.description||""} ${j.stage} ${j.supplier||""}`.toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });
  const add=f=>{setJobs(p=>{const n=[...p,{...f,id:uid(),createdAt:today()}];persist(K.jo,n);return n;});setModal(null);};
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
    <SectionHeader title="Jobs" action={clients.length>0?<Btn onClick={()=>setModal("add")}>+ Add job</Btn>:<span style={{fontSize:13,color:WG}}>Add a client first</span>}/>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search jobs by client, type or description…" style={{...SS.inp,marginBottom:14,marginTop:0}}/>
    {typesByCount.length>0&&<div style={{marginBottom:16}}>
      <div style={{...SS.lbl,marginBottom:10}}>Job types</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
        <div style={{borderRadius:RADIUS,boxShadow:tf==="All"?`0 0 0 2px ${GOLD}`:"none"}}>
          <Stat tint="blue" icon="◎" value={jobs.length} label="All jobs" onClick={()=>setTf("All")}/>
        </div>
        {typesByCount.map(t=>(
          <div key={t} style={{borderRadius:RADIUS,boxShadow:tf===t?`0 0 0 2px ${GOLD}`:"none"}}>
            <Stat tint="blue" icon={JOB_TYPE_ICONS[t]||"◎"} value={typeCounts[t]} label={t} onClick={()=>setTf(tf===t?"All":t)}/>
          </div>
        ))}
      </div>
    </div>}
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {["All",...JOB_STAGES].map(s=><button key={s} onClick={()=>setSf(s)} style={{padding:"4px 11px",borderRadius:20,border:`1px solid ${sf===s?GOLD:BD}`,background:sf===s?GOLD:"transparent",color:sf===s?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{s}</button>)}
    </div>
    {(q||tf!=="All"||sf!=="All")&&<div style={{fontSize:12,color:WG,marginBottom:12}}>Showing <b style={{color:INK}}>{filtered.length}</b> of {jobs.length} job{jobs.length!==1?"s":""}{tf!=="All"?` · ${tf}`:""}{sf!=="All"?` · ${sf}`:""}{q?` · “${search.trim()}”`:""}{(q||tf!=="All"||sf!=="All")&&<button onClick={()=>{setSearch("");setTf("All");setSf("All");}} style={{background:"none",border:"none",color:GOLD,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginLeft:8,padding:0}}>Clear</button>}</div>}
    {filtered.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"14px 0"}}>No jobs found{q?` for “${search.trim()}”`:""}.</div></Card>}
    {filtered.map(j=>{
      const c=clients.find(x=>x.id===j.clientId);
      const od=j.deadline&&j.deadline<today()&&j.stage!=="Collected";
      const total=jobChargeTotal(j,quotes,markupTable);
      const paid=payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
      const owing=total-paid;
      const isOverride=Number(j.totalOverride)>0;
      return <Card key={j.id} onClick={()=>{setSelJob(j.id);setView("jobDetail");}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:2}}>{j.type} <span style={{color:WG,fontWeight:400,fontSize:13}}>· {c?.name}</span></div>
          <div style={{fontSize:12,color:od?DANGER:WG,marginBottom:5}}>Due {fmtDate(j.deadline)}{od?" — OVERDUE":""}</div>
          {j.description&&<div style={{fontSize:13,color:INK}}>{j.description.slice(0,90)}{j.description.length>90?"…":""}</div>}</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <Badge label={j.stage} color={SC[j.stage]||WG}/>
            <button onClick={e=>delJob(j.id,e)} style={{background:"none",border:`1px solid ${DANGER}44`,borderRadius:2,padding:"3px 10px",fontSize:11,color:DANGER,cursor:"pointer",fontFamily:"inherit",fontWeight:700,letterSpacing:"0.04em",opacity:0.7}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.7}>Delete</button>
          </div>
        </div>
        {total>0&&<div style={{display:"flex",gap:18,marginTop:12,paddingTop:10,borderTop:`1px solid ${BD}`,fontSize:12,flexWrap:"wrap"}}>
          <span style={{color:WG}}>Total <b style={{color:INK}}>{fmt(total)}</b>{isOverride&&<span style={{color:GOLD_D,fontSize:10,fontWeight:700,marginLeft:5,letterSpacing:"0.04em"}}>OVERRIDE</span>}</span>
          <span style={{color:WG}}>Paid <b style={{color:OK}}>{fmt(paid)}</b></span>
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
  const NTC={"Client call":"#3B6E8F","Client email":"#5B7FA6","Client visit":"#7B5EA7","Approval received":"#2D7A4F","Internal update":"#888780","General note":"#6B6560"};
  const add=()=>{if(!form.text.trim())return;const n={...form,id:uid(),jobId,createdAt:new Date().toISOString()};setNotes(p=>{const nw=[...p,n];persist(K.no,nw);return nw;});setForm(f=>({...f,text:""}));};
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
        added.push({id:uid(),path,caption:"",uploadedAt:new Date().toISOString()});
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
      <label style={{background:GOLD,color:WHITE,borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:busy?"default":"pointer",fontFamily:"inherit",letterSpacing:"0.02em",opacity:busy?0.6:1}}>
        {busy?"Uploading…":"+ Upload images"}
        <input type="file" accept="image/*" multiple disabled={busy} onChange={e=>{onFiles(e.target.files);e.target.value="";}} style={{display:"none"}}/>
      </label>
    </div>
    {err&&<div style={{background:DANGER+"15",border:`1px solid ${DANGER}44`,color:DANGER,fontSize:12,padding:"8px 12px",borderRadius:8,marginBottom:12}}>{err}</div>}
    {images.length===0&&!busy&&<div style={{fontSize:13,color:WG,fontStyle:"italic",padding:"8px 0"}}>No images yet. Upload reference shots, CAD renders, progress photos or the finished piece.</div>}
    {images.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
      {images.map(img=>(
        <div key={img.id} style={{border:`1px solid ${BD}`,borderRadius:10,overflow:"hidden",background:PARCH}}>
          <div onClick={()=>urls[img.path]&&setLightbox(urls[img.path])} style={{width:"100%",height:130,background:`#EEE center/cover no-repeat`,backgroundImage:urls[img.path]?`url(${urls[img.path]})`:"none",cursor:urls[img.path]?"zoom-in":"default",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {!urls[img.path]&&<span style={{fontSize:11,color:WG}}>loading…</span>}
          </div>
          <div style={{padding:"7px 8px"}}>
            <input value={img.caption||""} onChange={e=>setCaption(img,e.target.value)} placeholder="Add caption…" style={{...SS.inp,marginTop:0,fontSize:11,padding:"4px 7px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
              <span style={{fontSize:10,color:WG}}>{fmtDate(img.uploadedAt)}</span>
              <button onClick={()=>removeImg(img)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:11,fontWeight:700,fontFamily:"inherit",padding:0}}>Remove</button>
            </div>
          </div>
        </div>
      ))}
    </div>}
    {lightbox&&<div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:30,cursor:"zoom-out"}}>
      <img src={lightbox} alt="" style={{maxWidth:"100%",maxHeight:"100%",borderRadius:8,boxShadow:"0 20px 80px rgba(0,0,0,0.6)"}}/>
    </div>}
  </Card>;
}

function RepairIntakeCard({job,setJobs,biz,clients,markupTable}){
  const c=clients.find(x=>x.id===job.clientId);
  const intake=job.intake||{};
  const blankIntakeItem=()=>({id:uid(),itemType:"",damage:"",condition:"",price:"",priceMode:"set"});
  const[items,setItems]=useState(()=>{const ex=intakeItems(intake);return ex.length?ex.map(i=>({id:i.id||uid(),itemType:i.itemType||"",damage:i.damage||"",condition:i.condition||"",price:i.price!=null?String(i.price):"",priceMode:i.priceMode||"set"})):[blankIntakeItem()];});
  // Effective customer price (inc GST) for an item: a "set" price is used as-is; a "cost"
  // is run through the manufacturing markup table (bracket multiplier, then rounded).
  const itemClient=it=>{
    const v=Number(it.price)||0;if(v<=0)return 0;
    if(it.priceMode==="cost"){const b=getBracket(v,markupTable);return roundQ(v*(b?b.multiplier:1));}
    return v;
  };
  const itemMult=it=>{const b=getBracket(Number(it.price)||0,markupTable);return b?b.multiplier:null;};
  const[instructions,setInstructions]=useState(intake.instructions||"");
  const[dIn,setDIn]=useState(job.dateIn||"");
  const[dOut,setDOut]=useState(job.dateOut||"");
  // If a client link exists, keep its cloud snapshot in sync with edits so the link never goes stale.
  const refreshSnapshot=(itemsArg,instrArg,over)=>{
    if(!job.repairToken||!supabaseEnabled||!supabase)return;
    const snap=buildRepairSnapshot({job:{...job,dateIn:over&&"dateIn"in over?over.dateIn:dIn,dateOut:over&&"dateOut"in over?over.dateOut:dOut},client:c,biz,items:itemsArg.map(it=>({...it,clientPrice:itemClient(it)})),instructions:instrArg});
    supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",job.repairToken).then(()=>{}).catch(()=>{});
  };
  // Persist the whole intake (items + instructions) as the new shape, and refresh the link snapshot
  const saveIntake=(nextItems,nextInstr)=>{setJobs(p=>{const n=p.map(j=>j.id===job.id?{...j,intake:{items:nextItems,instructions:nextInstr}}:j);persist(K.jo,n);return n;});refreshSnapshot(nextItems,nextInstr);};
  const persistJob=patch=>{setJobs(p=>{const n=p.map(j=>j.id===job.id?{...j,...patch}:j);persist(K.jo,n);return n;});if("dateIn"in patch||"dateOut"in patch)refreshSnapshot(items,instructions,patch);};
  const setItemField=(id,k,v)=>setItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const commit=()=>saveIntake(items,instructions);
  const addItem=()=>{const ni=[...items,blankIntakeItem()];setItems(ni);saveIntake(ni,instructions);};
  const removeItem=id=>{const ni=items.filter(i=>i.id!==id);setItems(ni);saveIntake(ni,instructions);};
  const moveItem=(id,dir)=>{const i=items.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=items.length)return;const ni=[...items];[ni[i],ni[j]]=[ni[j],ni[i]];setItems(ni);saveIntake(ni,instructions);};
  const repairTotal=items.reduce((s,i)=>s+itemClient(i),0);
  const setAsCharge=()=>{persistJob({totalOverride:repairTotal});alert(`Job charge set to ${fmt(repairTotal)} from the repair items.`);};
  const[saved,setSaved]=useState(false);
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
    const snap=buildRepairSnapshot({job:{...job,dateIn:dIn,dateOut:dOut,repairToken:token},client:c,biz,items:items.map(it=>({...it,clientPrice:itemClient(it)})),instructions});
    const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).upsert({token,data:snap,status:"sent",created_at:new Date().toISOString()},{onConflict:"token"});
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
    if(JSON.stringify(job.repairResponse||null)!==JSON.stringify(r))persistJob({repairResponse:r});
  };
  useEffect(()=>{if(!response)fetchResponse(true);},[job.repairToken]);   // eslint-disable-line
  const saveNow=()=>{saveIntake(items,instructions);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  return <Card id="repair-intake">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{fontWeight:700,fontSize:15,color:INK}}>Repair Intake {items.length>1&&<span style={{fontWeight:400,color:WG,fontSize:13}}>· {items.length} items</span>}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <Btn sm onClick={shareRepair}>{linkBusy?"Creating…":linkCopied?"✓ Link copied":job.repairToken?"🔗 Copy link":"🔗 Create link"}</Btn>
        {job.repairToken&&<Btn sm ghost onClick={()=>window.open(repairLink,"_blank")}>Preview</Btn>}
        <Btn sm ghost onClick={()=>printRepairIntake(biz,c,{...job,dateIn:dIn,dateOut:dOut,intake:{items:items.map(it=>({...it,clientPrice:itemClient(it)})),instructions}})}>Print / Save PDF</Btn>
      </div>
    </div>
    {job.repairToken&&<div style={{background:GOLD_L+"55",border:`1px solid ${GOLD}55`,borderRadius:8,padding:"9px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:12,fontWeight:700,color:GOLD_D,whiteSpace:"nowrap"}}>🔗 Client link</span>
      <span style={{flex:1,minWidth:180,fontSize:12,color:WG,wordBreak:"break-all",fontFamily:"monospace"}}>{repairLink}</span>
      {!response&&<><span style={{fontSize:11,fontWeight:700,color:WG,whiteSpace:"nowrap"}}>⏳ Awaiting client response</span>
        <button onClick={()=>fetchResponse(false)} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>{checking?"Checking…":"Check now"}</button></>}
    </div>}
    {response&&(()=>{const acc=response.decision!=="declined";return <div style={{background:(acc?OK:DANGER)+"12",border:`1px solid ${(acc?OK:DANGER)}55`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,fontWeight:700,color:acc?OK:DANGER}}>
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
      <div key={it.id} style={{border:`1px solid ${BD}`,borderRadius:10,padding:"14px 16px",marginBottom:12,background:PARCH}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:GOLD_D,textTransform:"uppercase",letterSpacing:"0.06em"}}>Item {idx+1}</div>
          {items.length>1&&<div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>moveItem(it.id,-1)} disabled={idx===0} title="Move up" style={{background:"none",border:`1px solid ${BD}`,borderRadius:5,padding:"2px 7px",cursor:idx===0?"not-allowed":"pointer",color:idx===0?BD:WG,fontSize:12,fontFamily:"inherit",lineHeight:1}}>↑</button>
            <button onClick={()=>moveItem(it.id,1)} disabled={idx===items.length-1} title="Move down" style={{background:"none",border:`1px solid ${BD}`,borderRadius:5,padding:"2px 7px",cursor:idx===items.length-1?"not-allowed":"pointer",color:idx===items.length-1?BD:WG,fontSize:12,fontFamily:"inherit",lineHeight:1}}>↓</button>
            <button onClick={()=>removeItem(it.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:12,fontWeight:700,fontFamily:"inherit"}}>× Remove</button>
          </div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 220px",gap:12,marginBottom:12}}>
          <div>
            <div style={SS.lbl}>Item type</div>
            <input style={SS.inp} value={it.itemType} placeholder="e.g. Gold ring, silver bracelet…" onChange={e=>setItemField(it.id,"itemType",e.target.value)} onBlur={commit}/>
          </div>
          <div>
            <div style={{display:"flex",gap:4,marginBottom:4}}>
              {[["set","Set price"],["cost","Cost + markup"]].map(([m,lbl])=>(
                <button key={m} onClick={()=>{setItemField(it.id,"priceMode",m);setTimeout(commit,0);}}
                  style={{flex:1,padding:"5px 6px",borderRadius:6,border:`1px solid ${it.priceMode===m?INK:BD}`,background:it.priceMode===m?INK:"transparent",color:it.priceMode===m?WHITE:WG,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
              ))}
            </div>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
              <input type="number" min="0" step="0.01" style={{...SS.inp,marginTop:0,padding:"9px 10px 9px 22px",textAlign:"right",fontWeight:Number(it.price)>0?700:400}} value={it.price} placeholder={it.priceMode==="cost"?"Trade cost":"0.00"} onChange={e=>setItemField(it.id,"price",e.target.value)} onBlur={commit}/>
            </div>
            <div style={{fontSize:10,color:WG,marginTop:4,textAlign:"right",lineHeight:1.4}}>
              {it.priceMode==="cost"
                ?(Number(it.price)>0
                    ?(itemMult(it)?<>×{itemMult(it)} markup → <strong style={{color:OK}}>{fmt(itemClient(it))}</strong> inc GST</>:<span style={{color:WARN}}>cost outside markup table</span>)
                    :"Trade cost — manufacturing markup applied")
                :"Final price (inc GST)"}
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
    <button onClick={addItem} style={{background:"none",border:`1px dashed ${GOLD}`,borderRadius:8,padding:"8px 16px",color:GOLD_D,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:16}}>+ Add another item</button>

    {/* Repair total */}
    {repairTotal>0&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",background:INK,borderRadius:10,padding:"14px 18px",marginBottom:16}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Repair total{items.filter(i=>Number(i.price)>0).length>1?` · ${items.filter(i=>Number(i.price)>0).length} items`:""}</div>
        <div style={{fontSize:22,fontWeight:800,color:WHITE,marginTop:2}}>{fmt(repairTotal)} <span style={{fontSize:12,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>inc GST</span></div>
      </div>
      <button onClick={setAsCharge} style={{background:GOLD,border:"none",borderRadius:8,padding:"9px 16px",color:WHITE,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Set as job charge →</button>
    </div>}

    <div style={{marginBottom:16}}>
      <div style={SS.lbl}>Client instructions <span style={{fontWeight:400,color:WG}}>(optional — applies to the whole drop-off)</span></div>
      <textarea style={{...SS.inp,minHeight:56,resize:"vertical"}} value={instructions} placeholder="Any specific requests from the client…" onChange={e=>setInstructions(e.target.value)} onBlur={commit}/>
    </div>
    <div style={{fontSize:12,color:WG,lineHeight:1.7,padding:"12px 14px",background:PARCH,borderRadius:8,border:`1px solid ${BD}`}}>
      <strong style={{color:INK}}>Disclaimer: </strong>We are not responsible for damage to client-supplied gemstones during repair. We do not provide a warranty on repaired pieces — all repairs are undertaken at the client's risk.
    </div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,marginTop:16}}>
      <span style={{fontSize:12,color:WG,fontStyle:"italic"}}>Your changes save automatically.</span>
      <Btn onClick={saveNow}>{saved?"✓ Saved":"Save intake"}</Btn>
    </div>
  </Card>;
}

function JobDetail({jobId,jobs,setJobs,clients,quotes,setQuotes,payments,setPayments,notes,setNotes,invoices,setInvoices,proposals,setProposals,biz,markupTable,setView}){
  const job=jobs.find(j=>j.id===jobId);
  if(!job)return null;
  const c=clients.find(x=>x.id===job.clientId);
  const jq=quotes.filter(q=>q.jobId===jobId);
  const jp=payments.filter(p=>p.jobId===jobId);
  const ji=invoices.filter(i=>i.jobId===jobId);
  const paidTotal=jp.filter(p=>p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const usingOverride=Number(job.totalOverride)>0;
  const jobTotal=jobChargeTotal(job,quotes,markupTable);
  const balance=jobTotal-paidTotal;
  const[editStage,setEditStage]=useState(false);
  const[editJobModal,setEditJobModal]=useState(false);
  const[payModal,setPayModal]=useState(false);
  const moveStage=s=>{setJobs(p=>{const n=p.map(j=>j.id===jobId?{...j,stage:s}:j);persist(K.jo,n);return n;});setEditStage(false);};
  // Keep any live invoice/proposal link(s) for this job in sync after a payment change, so the
  // customer's link shows the updated Paid / Balance due instead of a stale snapshot.
  const refreshLinks=(pmts)=>{
    if(!supabaseEnabled||!supabase)return;
    ji.filter(iv=>iv.publicToken).forEach(iv=>{
      const snap=buildInvoiceSnapshot({inv:iv,job,client:c,biz,payments:pmts});
      supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",iv.publicToken).then(()=>{}).catch(()=>{});
    });
    (proposals||[]).filter(pr=>pr.jobId===jobId&&pr.token&&pr.status!=="accepted").forEach(pr=>{
      const snap=buildProposalSnapshot({proposal:pr,job,client:c,biz,quotes,markupTable,payments:pmts});
      supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",pr.token).then(()=>{}).catch(()=>{});
    });
  };
  const addPay=f=>{const n=[...payments,{...f,id:uid(),jobId,date:f.date||today()}];setPayments(n);persist(K.pa,n);refreshLinks(n);setPayModal(false);};
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
    const q=quotes.find(x=>x.id===qid);if(!q)return;
    const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
    // GST-inclusive model: the quoted price already includes GST. Total = quoted price;
    // the GST component is total ÷ 11 (disclosed on the invoice, never added on top).
    const totalIncGST=quoteGrandTotal(q,markupTable);
    const gst=totalIncGST-totalIncGST/(1+GST_RATE);
    const exGST=totalIncGST-gst;
    const num=nextInvoiceNumber(invoices);
    // Pre-fill the customer-facing description from the quote (or job) so it's ready to edit
    const descriptionOverride=q.clientDescription||job?.description||"";
    // Carry the sourced centre/feature stone onto the invoice as a line (it lives separately on
    // the quote, not in lineItems). Accent stones already live in lineItems.
    const lineItems=[...q.lineItems];
    const centreInc=q.stoneClientTotal||0;
    if(centreInc>0){
      const sDescs=(q.stoneItems||[]).map(s=>(s.description||"").trim()).filter(Boolean);
      const sDetails=(q.stoneItems||[]).map(s=>(s.detail||"").trim()).filter(Boolean);
      lineItems.push({id:uid(),
        description:sDescs.length?sDescs.join(" + "):(q.stoneType==="lab"?"Lab-grown":"Natural")+" diamond / gemstone",
        detail:sDetails.length?sDetails.join(" · "):"Supplied & set",
        costLow:centreInc.toFixed(2),noMarkup:true});
    }
    // A manual-price quote may have no line items — give the invoice one so it isn't blank
    if(!lineItems.length)lineItems.push({id:uid(),description:quoteLabel(q),detail:"As quoted",costLow:totalIncGST.toFixed(2),noMarkup:true});
    const inv={id:uid(),jobId,quoteId:qid,number:num,date:today(),status:"Unpaid",exGST,gst,totalIncGST,lineItems,notes:q.notes||"",descriptionOverride,calc};
    setInvoices(p=>{const n=[...p,inv];persist(K.inv,n);return n;});
    setView("invoiceDetail_"+inv.id);
  };
  return <div>
    <button onClick={()=>setView("jobs")} style={{background:"none",border:"none",cursor:"pointer",color:GOLD,fontSize:13,fontWeight:700,fontFamily:"inherit",marginBottom:18,padding:0}}>← Back to jobs</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
      <div><h1 style={{margin:0,fontSize:24,fontWeight:800,color:INK,letterSpacing:"-0.02em"}}>{job.type}</h1>
      <div style={{color:WG,fontSize:13,marginTop:3}}>{c?.name} · Due {fmtDate(job.deadline)}</div>
      {(job.dateIn||job.dateOut)&&<div style={{fontSize:12,color:WG,marginTop:2}}>Taken in: <b style={{color:INK}}>{job.dateIn?fmtDate(job.dateIn):"—"}</b> · Pickup: <b style={{color:INK}}>{job.dateOut?fmtDate(job.dateOut):"—"}</b></div>}
      {job.supplier&&<div style={{fontSize:12,color:WG,marginTop:2}}>Supplier: {job.supplier}{job.supplierRef?` · ${job.supplierRef}`:""}</div>}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <Badge label={job.stage} color={SC[job.stage]||WG} size="lg"/>
        <Btn sm ghost onClick={()=>setEditStage(v=>!v)}>Move stage</Btn>
        <Btn sm ghost onClick={()=>setEditJobModal(true)}>Edit job</Btn>
        <Btn sm danger onClick={delJob}>Delete job</Btn>
      </div>
    </div>
    {editStage&&<Card style={{background:PARCH}}>
      <div style={{...SS.lbl,marginBottom:10}}>Move to stage</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {JOB_STAGES.map(s=><button key={s} onClick={()=>moveStage(s)} style={{padding:"4px 11px",borderRadius:20,border:`1px solid ${job.stage===s?SC[s]:BD}`,background:job.stage===s?(SC[s]+"22"):"transparent",color:job.stage===s?SC[s]:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{s}</button>)}
      </div>
    </Card>}
    {job.description&&<Card><div style={{...SS.lbl,marginBottom:8}}>Description</div><div style={{fontSize:14,color:INK,lineHeight:1.7}}>{job.description}</div>{job.notes&&<div style={{marginTop:10,fontSize:13,color:WG,fontStyle:"italic",borderTop:`1px solid ${BD}`,paddingTop:10}}>Notes: {job.notes}</div>}</Card>}
    {job.type==="Repair"&&<RepairIntakeCard job={job} setJobs={setJobs} biz={biz} clients={clients} markupTable={markupTable}/>}
    <JobImages job={job} setJobs={setJobs}/>
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,color:INK}}>Payments</div>
        <Btn sm onClick={()=>setPayModal(true)}>+ Record payment</Btn>
      </div>
      {jobTotal>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[[usingOverride?"Total charge":"Approx. quote",fmt(jobTotal),INK],["Received",fmt(paidTotal),OK],["Outstanding",fmt(Math.max(0,balance)),balance>0.5?WARN:OK]].map(([l,v,col])=>(
          <div key={l} style={{background:PARCH,borderRadius:10,padding:"10px 12px",border:`1px solid ${BD}`}}>
            <div style={{fontSize:10,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</div>
            <div style={{fontSize:19,fontWeight:800,color:col,marginTop:3}}>{v}</div>
          </div>
        ))}
      </div>}
      {jp.length===0&&<div style={{color:WG,fontSize:14}}>No payments yet.</div>}
      {jp.map(p=>(
        <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${BD}`}}>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:INK,textAlign:"center"}}>{p.type}</div><div style={{fontSize:12,color:WG,marginTop:1}}>{fmtDate(p.date)} · {p.method}{p.notes?` · ${p.notes}`:""}</div></div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Badge label={p.status} color={p.status==="Received"?OK:WARN}/>
            <div style={{fontWeight:800,fontSize:14,color:INK,minWidth:76,textAlign:"right"}}>{fmt(p.amount)}</div>
            <button onClick={()=>delPay(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0}}>×</button>
          </div>
        </div>
      ))}
    </Card>
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:14}}>Invoices ({ji.length})</div>
      {ji.length===0&&<div style={{color:WG,fontSize:14}}>No invoices yet. Create one from an approved quote below.</div>}
      {ji.map(inv=>(
        <div key={inv.id} onClick={()=>setView("invoiceDetail_"+inv.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${BD}`,cursor:"pointer"}}>
          <div><div style={{fontWeight:600,fontSize:14,color:INK}}>{inv.number}</div><div style={{fontSize:12,color:WG,marginTop:1}}>{fmtDate(inv.date)}</div></div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Badge label={inv.status} color={inv.status==="Paid"?OK:WARN}/>
            <div style={{fontWeight:800,fontSize:14,color:INK}}>{fmt(inv.totalIncGST)} <span style={{fontSize:11,color:WG,fontWeight:400}}>inc GST</span></div>
          </div>
        </div>
      ))}
    </Card>
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,color:INK}}>Quotes ({jq.length})</div>
        <Btn sm onClick={()=>setView("newQuote_"+jobId)}>+ New quote</Btn>
      </div>
      {jq.length===0&&<div style={{color:WG,fontSize:14}}>No quotes yet.</div>}
      {jq.map(q=>{
        const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
        const hasInv=invoices.some(i=>i.quoteId===q.id);
        const manual=quoteIsManual(q);
        const stoneTotal=(q.stoneClientTotal||0)+(q.accentStoneTotal||0);
        const priceStr=manual?fmtR(Number(q.manualTotal)):(calc.base>0&&!calc.bracket&&!calc.overridden)?"—":fmtR(calc.finalLow+stoneTotal);
        return <div key={q.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${BD}`}}>
          <div style={{cursor:"pointer",flex:1}} onClick={()=>setView("quoteDetail_"+q.id)}>
            <div style={{fontWeight:600,fontSize:14,color:INK}}>{quoteLabel(q)} <span style={{fontWeight:400,color:WG,fontSize:12}}>{q.title?.trim()?quoteRef(q):""}</span></div>
            <div style={{fontSize:12,color:WG,marginTop:1}}>{manual?<>Manual quoted price → </>:<>Base: {fmt(calc.baseLow)} → {calc.mult}× → </>}<strong style={{color:OK}}>{priceStr}</strong></div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Badge label={q.status} color={q.status==="Approved"?OK:q.status==="Draft"?WG:GOLD_D}/>
            {q.status==="Approved"&&!hasInv&&<Btn sm onClick={()=>createInvoice(q.id)}>→ Invoice</Btn>}
          </div>
        </div>;
      })}
    </Card>
    <JobProposals job={job} client={c} quotes={jq} proposals={proposals} setProposals={setProposals} setQuotes={setQuotes} biz={biz} markupTable={markupTable} payments={jp}/>
    <ActivityLog jobId={jobId} notes={notes} setNotes={setNotes}/>
    {payModal&&<Modal title="Record payment" onClose={()=>setPayModal(false)}>
      <PaymentForm onSave={addPay} onCancel={()=>setPayModal(false)} suggestedAmount={balance>0?balance:""}/>
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
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label="Payment stage" value={f.type} onChange={set("type")} as="select" options={PAY_TYPES}/>
      <Input label="Amount ($)" value={f.amount} onChange={set("amount")} type="number" min="0" step="0.01"/>
      <Input label="Date" value={f.date} onChange={set("date")} type="date"/>
      <Input label="Method" value={f.method} onChange={set("method")} as="select" options={PAY_METHODS}/>
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
const CAD_TIER_COLORS={"None (no charge)":WG,"Simple Design":"#5B7FA6","Standard Design":GOLD_D,"Complex Design":"#7B5EA7"};

// ── Accent Stone Modal ────────────────────────────────────────────────────
const STONE_SHAPES=["Round","Marquise","Pear","Oval","Princess","Emerald","Cushion","Baguette","Trillion","Asscher","Radiant","Heart","Other"];
function AccentStoneModal({pricing,setPricing,naturalStoneMarkup,labStoneMarkup,onAdd,onClose}){
  const accentDB=pricing.filter(p=>p.category==="Accent Stones");
  const[costs,setCosts]=useState({});
  const[adding,setAdding]=useState(false);
  const[newName,setNewName]=useState("");
  const[newDetail,setNewDetail]=useState("");
  // Quick structured fancy / cut stone entry
  const[shape,setShape]=useState("Round");
  const[size,setSize]=useState("");
  const[qty,setQty]=useState("");
  const[cost,setCost]=useState("");
  const[qMarkup,setQMarkup]=useState("mfg");
  const qn=Math.max(1,Number(qty)||1);            // descriptive count (defaults to 1)
  const cn=Number(cost)||0;                        // single TOTAL cost for the stone(s)
  const canAdd=cn>0;
  const quickDesc=`${qn>1?qn+" × ":""}${shape}${size?` ${size}`:""}`.trim();
  // When priced on the stone (natural/lab) markup, show the resulting client price
  const stoneMU=qMarkup==="natural"||qMarkup==="lab";
  const stonePreview=stoneMU&&cn>0?calcStoneQuote([{cost:cn}],qMarkup==="lab"?labStoneMarkup:naturalStoneMarkup):null;
  const addQuick=()=>{
    if(cn<=0)return alert("Enter the cost.");
    // No auto per-stone detail — the description already carries qty/shape/size, and the cost is a total.
    onAdd({description:quickDesc,detail:"",costLow:cn.toFixed(2),markupMode:qMarkup});
  };
  const saveAndAdd=()=>{
    if(!newName.trim())return alert("Enter a stone name");
    const item={id:uid(),category:"Accent Stones",name:newName.trim(),detail:newDetail.trim(),unit:"stone",baseCost:0};
    setPricing(p=>{const n=[...p,item];persist(K.pr,n);return n;});
    onAdd({description:item.name,detail:item.detail,costLow:""});
  };
  return <Modal title="Add accent & fancy stone" onClose={onClose}>
    {!adding&&<>
      {/* Quick structured cut/fancy stone entry */}
      <div style={{background:PARCH,border:`1px solid ${BD}`,borderRadius:10,padding:"14px 16px",marginBottom:18}}>
        <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Quick add — cut / fancy stone</div>
        <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 0.6fr 0.9fr",gap:"0 12px"}}>
          <Input label="Cut / shape" value={shape} onChange={setShape} as="select" options={STONE_SHAPES}/>
          <Input label="Size / dimensions" value={size} onChange={setSize} placeholder="e.g. 4×2mm"/>
          <Input label="Qty" value={qty} onChange={setQty} type="number" min="1" placeholder="1"/>
          <Input label="Cost" value={cost} onChange={setCost} type="number" min="0" step="0.01" placeholder="0.00"/>
        </div>
        <div style={{fontSize:10,color:WG,marginTop:-2,marginBottom:10,fontStyle:"italic"}}>Shape, size &amp; qty are for the description only — they don't affect the price. Cost is the total you paid for the stone(s).</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:WG,fontWeight:700}}>Markup</span>
            <select value={qMarkup} onChange={e=>setQMarkup(e.target.value)} style={{...SS.inp,marginTop:0,width:160,fontSize:12,padding:"7px 8px"}}>
              <option value="mfg">Manufacturing</option>
              <option value="natural">Natural stone</option>
              <option value="lab">Lab stone</option>
            </select>
          </div>
          <Btn sm onClick={addQuick} disabled={!canAdd}>Add to quote</Btn>
        </div>
        {/* Markup hint — when on the stone markup, show the resulting client price */}
        {stoneMU&&<div style={{fontSize:11,marginTop:8,color:stonePreview?(stonePreview.bracket?"#7B5EA7":WARN):WG}}>
          {stonePreview
            ?(stonePreview.bracket?<>→ <strong>{fmtR(stonePreview.clientTotal)}</strong> to client (×{stonePreview.mult} + GST)</>:"Cost is outside your stone markup table — check the rates in Pricing DB.")
            :"Priced on the "+(qMarkup==="lab"?"lab-grown":"natural")+" stone markup (cost × tier + GST). Enter a cost to preview."}
        </div>}
        {!stoneMU&&<div style={{fontSize:11,marginTop:8,color:WG}}>Priced with the jewellery piece on the manufacturing markup.</div>}
        {quickDesc&&<div style={{fontSize:11,color:WG,marginTop:8}}>Adds: <strong style={{color:INK}}>{quickDesc}</strong>{cn>0?<> · cost {fmt(cn)}</>:""}</div>}
      </div>
      <div style={{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Or pick from your saved catalog</div>
      {accentDB.length===0
        ?<div style={{textAlign:"center",padding:"8px 0 4px"}}>
          <div style={{fontSize:13,color:WG,marginBottom:14,lineHeight:1.6}}>No saved stone types yet. Save your commonly used stones to pick them quickly in future quotes.</div>
          <Btn sm ghost onClick={()=>setAdding(true)}>+ Add a stone type to catalog</Btn>
        </div>
        :<>
          <div style={{fontSize:13,color:WG,marginBottom:16,lineHeight:1.6}}>Pick a stone and enter your cost for this job.</div>
          {accentDB.map(item=>{
            const cost=costs[item.id]||"";
            return <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${BD}`}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:INK}}>{item.name}</div>
                {item.detail&&<div style={{fontSize:12,color:WG,marginTop:2}}>{item.detail}</div>}
              </div>
              <div style={{position:"relative",width:120,flexShrink:0}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>$</span>
                <input type="number" value={cost} min="0" step="0.01" placeholder="Your cost"
                  onChange={e=>setCosts(p=>({...p,[item.id]:e.target.value}))}
                  style={{...SS.inp,marginTop:0,padding:"7px 8px 7px 22px",fontSize:13,textAlign:"right",width:"100%"}}/>
              </div>
              <Btn sm onClick={()=>onAdd({description:item.name,detail:item.detail||"",costLow:String(cost||"")})}>Add</Btn>
            </div>;
          })}
          <div style={{marginTop:18,paddingTop:14,borderTop:`1px solid ${BD}`}}>
            <button onClick={()=>setAdding(true)} style={{background:"none",border:"none",cursor:"pointer",color:GOLD,fontSize:13,fontWeight:700,fontFamily:"inherit",padding:0}}>
              + Save &amp; add a new stone type
            </button>
          </div>
        </>}
    </>}
    {adding&&<>
      <div style={{fontSize:13,color:WG,marginBottom:16,lineHeight:1.6}}>This stone type will be saved to your catalog for use in future quotes.</div>
      <Input label="Stone name" value={newName} onChange={setNewName} placeholder="e.g. 2mm blue sapphires"/>
      <Input label="Notes / detail (optional)" value={newDetail} onChange={setNewDetail} placeholder="e.g. heat treated, round, supplier XYZ"/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn ghost onClick={()=>setAdding(false)}>Back</Btn>
        <Btn onClick={saveAndAdd}>Save &amp; add to quote</Btn>
      </div>
    </>}
  </Modal>;
}

// ── Findings & Components Modal ───────────────────────────────────────────
// ── Centre Stone Setting calculator ───────────────────────────────────────
const centreSettingFee=(ct,complex,rates=DEFAULT_CENTRE_RATES)=>{
  const w=Number(ct)||0;
  if(w<=0)return 0;
  const perCt=complex?(Number(rates.complexPerCt)||0):(Number(rates.basicPerCt)||0);
  return w*perCt;
};
function CentreStonePicker({onAdd,centreRates=DEFAULT_CENTRE_RATES}){
  const[ct,setCt]=useState("");
  const[complex,setComplex]=useState(false);
  const w=Number(ct)||0;
  const fee=centreSettingFee(ct,complex,centreRates);
  const perCt=complex?centreRates.complexPerCt:centreRates.basicPerCt;
  return <div>
    <div style={{fontSize:12,color:WG,marginBottom:16,lineHeight:1.6}}>
      Centre stones are larger and higher-risk to set. Enter the carat weight and choose the setting type — the fee is calculated automatically.
      <br/><strong style={{color:INK}}>Basic</strong> = carat × {fmt(centreRates.basicPerCt)}/ct · <strong style={{color:INK}}>Complex</strong> = carat × {fmt(centreRates.complexPerCt)}/ct (pear claws, bezels, fragile stones, sapphires, etc.)
    </div>
    <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:"0 20px",alignItems:"start"}}>
      <div>
        <label style={SS.lbl}>Centre stone carat weight</label>
        <div style={{position:"relative",marginTop:4}}>
          <input type="number" value={ct} min="0" step="0.01" placeholder="e.g. 1.50" onChange={e=>setCt(e.target.value)}
            style={{...SS.inp,marginTop:0,paddingRight:34,fontSize:15,fontWeight:700,textAlign:"right"}}/>
          <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>ct</span>
        </div>
      </div>
      <div>
        <label style={SS.lbl}>Setting type</label>
        <div style={{display:"flex",gap:10,marginTop:4}}>
          {[[false,"Basic","Round diamond, standard claw"],[true,"Complex","Pear claws, bezels, fragile / sapphire"]].map(([val,label,sub])=>(
            <button key={label} onClick={()=>setComplex(val)} style={{
              flex:1,padding:"10px 14px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",textAlign:"left",
              border:`2px solid ${complex===val?(val?"#B05C3A":"#4A8E6A"):BD}`,
              background:complex===val?(val?"#B05C3A11":"#4A8E6A11"):"transparent",transition:"all 0.12s"
            }}>
              <div style={{fontSize:13,fontWeight:700,color:complex===val?(val?"#B05C3A":"#4A8E6A"):INK}}>{label}</div>
              <div style={{fontSize:10,color:WG,marginTop:2,lineHeight:1.3}}>{sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
    <div style={{marginTop:18,background:fee>0?OK+"11":PARCH,border:`1px solid ${fee>0?OK:BD}`,borderRadius:10,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <div>
        <div style={{fontSize:12,fontWeight:700,color:INK}}>Centre stone setting — {complex?"complex":"basic"}</div>
        <div style={{fontSize:12,color:WG,marginTop:2}}>{w>0?`${w}ct × ${fmt(perCt)}/ct`:"Enter a carat weight to calculate"}</div>
      </div>
      <div style={{display:"flex",gap:12,alignItems:"center",flexShrink:0}}>
        <div style={{fontSize:20,fontWeight:800,color:fee>0?OK:WG}}>{fmt(fee)}</div>
        <Btn disabled={fee<=0} onClick={()=>onAdd(w,complex,fee)}>Add to quote</Btn>
      </div>
    </div>
  </div>;
}

function CADQuotePicker({pricing,selCAD,setSelCAD,pQty,setPQty,addFromDB}){
  const cadTiers=pricing.filter(p=>p.category==="CAD Design"&&p.cadTier);
  const cadRev=pricing.find(p=>p.category==="CAD Design"&&p.cadRevision);
  const revQty=pQty[cadRev?.id]||"";
  return <div>
    <div style={{fontSize:12,color:WG,marginBottom:14,lineHeight:1.6}}>
      Select a design tier — each includes 2 major revisions + unlimited minor revisions. Only one tier per quote.
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:10,marginBottom:20}}>
      {cadTiers.map(tier=>{
        const col=CAD_TIER_COLORS[tier.name]||WG;
        const sel=selCAD?.id===tier.id;
        const isNone=tier.baseCost===0;
        return <button key={tier.id}
          onClick={()=>setSelCAD(sel?null:tier)}
          style={{border:`2px solid ${sel?col:BD}`,borderRadius:12,padding:"14px",cursor:"pointer",background:sel?col+"18":WHITE,transition:"all 0.12s",textAlign:"left",fontFamily:"inherit"}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:sel?col:BD,marginBottom:8,transition:"background 0.12s"}}/>
          <div style={{fontSize:13,fontWeight:700,color:sel?col:INK,marginBottom:4}}>{tier.name}</div>
          <div style={{fontSize:18,fontWeight:800,color:sel?col:isNone?WG:INK}}>{isNone?"—":fmt(tier.baseCost)}</div>
          <div style={{fontSize:11,color:WG,marginTop:2}}>{isNone?"no charge":"per job"}</div>
        </button>;
      })}
    </div>
    {selCAD&&<div style={{background:selCAD.baseCost>0?OK+"11":PARCH,border:`1px solid ${selCAD.baseCost>0?OK:BD}`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:INK}}>CAD Design — {selCAD.name}</div>
        <div style={{fontSize:12,color:WG,marginTop:2}}>{selCAD.baseCost>0?"Incl. 2 major revisions + unlimited minor revisions":"No design fee charged"}</div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
        <div style={{fontSize:16,fontWeight:800,color:selCAD.baseCost>0?OK:WG}}>{selCAD.baseCost>0?fmt(selCAD.baseCost):"$0.00"}</div>
        <Btn onClick={()=>{addFromDB(selCAD,1);setSelCAD(null);}}>Add to quote</Btn>
      </div>
    </div>}
    {cadRev&&<div style={{borderTop:`1px solid ${BD}`,paddingTop:16}}>
      <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Additional revision (optional)</div>
      <div style={{display:"flex",alignItems:"center",gap:12,background:PARCH,borderRadius:10,padding:"12px 14px"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:INK}}>Additional revision</div>
          <div style={{fontSize:12,color:WG,marginTop:2}}>{fmt(cadRev.baseCost)}/hr · major revisions beyond the 2 included</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="number" value={revQty} min="1" step="1" placeholder="hrs"
            onChange={e=>setPQty(p=>({...p,[cadRev.id]:e.target.value}))}
            style={{...SS.inp,marginTop:0,width:70,padding:"7px 10px",fontSize:14,textAlign:"center"}}/>
          {revQty&&Number(revQty)>0&&<div style={{fontSize:13,fontWeight:800,color:OK,whiteSpace:"nowrap"}}>= {fmt(cadRev.baseCost*Number(revQty))}</div>}
          <Btn sm onClick={()=>addFromDB(cadRev,revQty||1)}>Add</Btn>
        </div>
      </div>
    </div>}
  </div>;
}

function QuoteBuilder({jobId:jobIdProp,editQuoteId,jobs,clients,quotes,setQuotes,pricing,setPricing,markupTable,naturalStoneMarkup,labStoneMarkup,centreRates=DEFAULT_CENTRE_RATES,setView}){
  const existingQuote=editQuoteId?quotes.find(q=>q.id===editQuoteId):null;
  const jobId=existingQuote?.jobId||jobIdProp;
  const job=jobs.find(j=>j.id===jobId);
  const c=job?clients.find(x=>x.id===job.clientId):null;
  const isEditing=!!existingQuote;
  const blankItem=()=>({id:uid(),description:"",detail:"",costLow:"",noMarkup:false});
  // Findings are no longer a separate section — fold any legacy finding:true items back
  // into the main line items (stripping the flag) so old quotes keep them, editable as normal.
  const[items,setItems]=useState(()=>existingQuote?.lineItems?.length?existingQuote.lineItems.filter(i=>!i.accentStone).map(({finding,...i})=>({...i})):[]);
  const[accentItems,setAccentItems]=useState(()=>existingQuote?.lineItems?.length?existingQuote.lineItems.filter(i=>i.accentStone).map(i=>({...i})):[]);
  const[notes,setNotes]=useState(existingQuote?.notes||"");
  const[clientDescription,setClientDescription]=useState(existingQuote?.clientDescription||"");
  const[title,setTitle]=useState(existingQuote?.title??(job?.type||""));   // prefill new quotes with the job type
  const[markupOverride,setMarkupOverride]=useState(existingQuote?.markupOverride?String(existingQuote.markupOverride):"");
  const[manualTotal,setManualTotal]=useState(existingQuote?.manualTotal?String(existingQuote.manualTotal):"");
  const[validUntil,setValidUntil]=useState(existingQuote?.validUntil||"");
  const[pricingModal,setPricingModal]=useState(false);
  const[pSearch,setPSearch]=useState("");
  const[pCat,setPCat]=useState("All");
  const[pQty,setPQty]=useState({});
  const[selCAD,setSelCAD]=useState(null);
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
    // Don't reopen stuck on a picker-only category (Centre Stone Setting / CAD) that hides the
    // browsable item list — return to "All" so you can always add ordinary items.
    if(pCat===CENTRE_SET_CAT||pCat==="CAD Design"){setPCat("All");setSelCAD(null);}
    setPricingModal(true);
  };
  const closePricing=()=>{setPricingModal(false);setSelCAD(null);};
  useEffect(()=>{
    if(!pricingModal)return;
    const h=e=>{if(e.key==="Escape"){setPricingModal(false);setSelCAD(null);}};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[pricingModal]);
  const[accentModal,setAccentModal]=useState(false);
  // Centre stone section
  const[stoneMode,setStoneMode]=useState(existingQuote?.stoneMode||"none");
  const[stoneType,setStoneType]=useState(existingQuote?.stoneType||"");
  const[stoneItems,setStoneItems]=useState(()=>existingQuote?.stoneItems?.length?existingQuote.stoneItems.map(i=>({...i})):[]);
  const[stoneNotes,setStoneNotes]=useState(existingQuote?.stoneNotes||"");
  const setStonItem=(id,k,v)=>setStoneItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const addStoneItem=()=>setStoneItems(p=>[...p,blankStoneItem()]);
  const removeStoneItem=id=>setStoneItems(p=>p.filter(i=>i.id!==id));
  const blankStoneItem=()=>({id:uid(),description:"",detail:"",cost:""});

  const setItem=(id,k,v)=>setItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const removeItem=id=>setItems(p=>p.filter(i=>i.id!==id));
  const setAccentItem=(id,k,v)=>setAccentItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const removeAccentItem=id=>setAccentItems(p=>p.filter(i=>i.id!==id));
  const moveItem=(id,dir)=>{
    setItems(p=>{const i=p.findIndex(x=>x.id===id);if(i<0)return p;const n=[...p];const t=n[i+dir];if(!t)return p;n[i+dir]=n[i];n[i]=t;return n;});
  };

  const addFromDB=(item,qty)=>{
    const q=Math.max(1,Number(qty)||1);
    const isDiamond=DIAMOND_CATS.includes(item.category);
    const isSetting=item.category==="Basic Setting"||item.category==="Complex Setting";
    const isPrintCast=item.category==="3D Print & Cast";
    const isCAD=item.category==="CAD Design";
    const isCADRevision=item.cadRevision;
    const desc=isDiamond?`${item.category} ${item.sizeMm}mm`
      :isSetting?(item.category==="Complex Setting"?`Complex setting ${item.sizeMm}mm`:`Basic setting ${item.sizeMm}mm`)
      :isPrintCast?`${item.name} (${q} piece${q!==1?"s":""})`
      :isCAD&&isCADRevision?`CAD revision (${q} hr${q!==1?"s":""})`
      :isCAD?`CAD Design — ${item.name}`
      :item.name;
    const totalCost=(item.baseCost*q).toFixed(2);
    const detail=isDiamond
      ?`${q} stone${q!==1?"s":""} × ${fmt(item.baseCost)}/stone (${item.caratWeight}ct each)`
      :isSetting
      ?`${q} stone${q!==1?"s":""} × ${fmt(item.baseCost)}/stone setting`
      :isPrintCast
      ?`${q} piece${q!==1?"s":""} × ${fmt(item.baseCost)}/piece`
      :isCAD&&isCADRevision
      ?`${q} hr × ${fmt(item.baseCost)}/hr`
      :isCAD&&item.baseCost>0
      ?`Incl. 2 major revisions + unlimited minor revisions`
      :isCAD
      ?"No design fee charged"
      :item.unit==="hr"?`${q} hr × ${fmt(item.baseCost)}/hr`
      :item.unit==="g"?`${q}g × ${fmt(item.baseCost)}/g`
      :item.unit==="piece"?`${q} piece${q!==1?"s":""}`
      :item.unit==="stone"?`${q} stone${q!==1?"s":""}`
      :q>1?`× ${q}`:"";
    setItems(p=>[...p,{id:uid(),description:desc,detail,costLow:String(totalCost),noMarkup:item.noMarkup||false}]);
    setPQty(p=>({...p,[item.id]:""}));   // clear this row's qty; popup stays open for more adds
    markAdded(item.id,totalCost);
  };

  const addCentreSetting=(ct,complex,fee)=>{
    const perCt=complex?centreRates.complexPerCt:centreRates.basicPerCt;
    const desc=`Centre stone setting — ${complex?"complex":"basic"}`;
    const detail=`${ct}ct centre stone · ${complex?"complex":"basic"} setting (${fmt(perCt)}/ct)`;
    setItems(p=>[...p,{id:uid(),description:desc,detail,costLow:fee.toFixed(2),noMarkup:false}]);
    markAdded("centre-setting",fee);
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
    setItems(p=>[...p,{id:uid(),description:manLabel.trim()||"Manual amount",detail:"Manual amount",costLow:amt.toFixed(2),noMarkup:false}]);
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
    setItems(p=>[...p,{id:uid(),description:desc,detail:"Manual amount",costLow:amt.toFixed(2),noMarkup:false}]);
    setPQty(p=>({...p,[item.id]:""}));   // clear this row only; popup stays open for more adds
    markAdded(item.id,amt);
  };

  const validAccentItems=accentItems.filter(i=>i.description.trim()&&Number(i.costLow)>0);
  // Manufacturing-markup accents join the jewellery list (same markup); natural/lab accents
  // are priced separately, so they keep their own section.
  const mfgAccents=accentItems.filter(i=>(i.markupMode||"mfg")==="mfg");
  const stoneAccents=accentItems.filter(i=>i.markupMode==="natural"||i.markupMode==="lab");
  const validItems=[...items.filter(i=>i.description.trim()&&Number(i.costLow)>0),...validAccentItems];
  const calc=calcQuote(validItems.length?validItems:items,markupTable,markupOverride);
  const validStoneItems=stoneItems.filter(i=>(Number(i.cost)||Number(i.costLow))>0);
  const activeStoneMarkup=stoneType==="lab"?labStoneMarkup:naturalStoneMarkup;
  const stoneCalc=stoneMode==="sourcing"&&stoneType&&validStoneItems.length>0?calcStoneQuote(validStoneItems,activeStoneMarkup):null;
  const stoneClientTotal=stoneCalc?.clientTotal||0;
  // Accent/fancy stones set to follow the stone markup — each priced like the centre stone (cost × stone tier + 10% GST)
  const accentStoneItems=validAccentItems.filter(i=>i.markupMode==="natural"||i.markupMode==="lab");
  const accentStoneTotal=accentStoneItems.reduce((s,i)=>{const sc=calcStoneQuote([{cost:i.costLow}],i.markupMode==="lab"?labStoneMarkup:naturalStoneMarkup);return s+(sc?.clientTotal||0);},0);
  const grandTotal=calc.finalLow+stoneClientTotal+accentStoneTotal;
  const manualOn=Number(manualTotal)>0;

  const save_=status=>{
    const baseValidItems=items.filter(i=>i.description.trim()&&Number(i.costLow)>0);
    const hasSourcedStones=stoneMode==="sourcing"&&validStoneItems.length>0;
    if(!baseValidItems.length&&!validAccentItems.length&&!hasSourcedStones&&!manualOn)return alert("Add at least one cost item — a line item, a sourced stone, or a manual quoted price.");
    if(isEditing){
      // Update existing quote — preserve id, jobId, createdAt
      const updated={...existingQuote,status,title:title.trim(),markupOverride:Number(markupOverride)||0,manualTotal:Number(manualTotal)||0,validUntil,notes,lineItems:validItems,
        stoneMode,stoneType:stoneMode==="sourcing"?stoneType:"",stoneItems:stoneMode==="sourcing"?validStoneItems:[],
        stoneNotes,stoneClientTotal:stoneCalc?.clientTotal||0,accentStoneTotal,clientDescription,updatedAt:today()};
      setQuotes(p=>{const n=p.map(q=>q.id===editQuoteId?updated:q);persist(K.qu,n);return n;});
    }else{
      const q={id:uid(),jobId,status,title:title.trim(),markupOverride:Number(markupOverride)||0,manualTotal:Number(manualTotal)||0,createdAt:today(),validUntil,notes,lineItems:validItems,
        stoneMode,stoneType:stoneMode==="sourcing"?stoneType:"",stoneItems:stoneMode==="sourcing"?validStoneItems:[],
        stoneNotes,stoneClientTotal:stoneCalc?.clientTotal||0,accentStoneTotal,clientDescription};
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
    <button onClick={()=>setView("jobDetail_"+jobId)} style={{background:"none",border:"none",cursor:"pointer",color:GOLD,fontSize:13,fontWeight:700,fontFamily:"inherit",marginBottom:18,padding:0}}>← Back to job</button>
    <div style={{marginBottom:20}}>
      <h1 style={{margin:0,fontSize:24,fontWeight:700,color:INK}}>{isEditing?"Edit quote":"New quote"}{title.trim()?`: ${title.trim()}`:""}</h1>
      {job&&<div style={{color:WG,fontSize:13,marginTop:3}}>{job.type} · {c?.name}</div>}
      {isEditing&&<div style={{fontSize:12,color:WG,marginTop:2}}>Quote {quoteRef(existingQuote)} · created {fmtDate(existingQuote.createdAt)}</div>}
    </div>

    <Card>
      {/* ── Quote title + expiry + client description ── */}
      <div style={{marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 200px",gap:"0 24px",marginBottom:16}}>
          <Input label="Quote title / label" value={title} onChange={setTitle} placeholder="e.g. Engagement ring, Diamond upgrade, Repair…"/>
          <Input label="Quote expiry date" value={validUntil} onChange={setValidUntil} type="date"/>
        </div>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <label style={SS.lbl}>Description for client</label>
            <div style={{background:OK+"22",color:OK,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,letterSpacing:"0.04em"}}>APPEARS ON PROPOSAL</div>
          </div>
          <textarea value={clientDescription} onChange={e=>setClientDescription(e.target.value)} rows={4}
            placeholder="e.g. Custom 18ct white gold engagement ring featuring a 1.52ct oval-cut sapphire with a diamond pavé halo. All stones hand-selected and set in our studio."
            style={{...SS.inp,marginTop:0,resize:"vertical",lineHeight:1.6,fontSize:13}}/>
        </div>
      </div>
      <div style={{borderTop:`1px solid ${BD}`,margin:"0 0 20px"}}/>

      {/* ── Setting & manufacturing line items ── */}
      <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Jewellery costs</div>
      {(items.length>0||mfgAccents.length>0)&&<><div style={{display:"grid",gridTemplateColumns:"200px 1fr 120px 80px",gap:8,marginBottom:6,padding:"0 2px"}}>
        {["Item","Detail / calculation","Cost",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>)}
      </div>
      <div style={{fontSize:11,color:WG,marginBottom:10,lineHeight:1.5}}>Toggle <strong style={{color:"#7B5EA7"}}>No markup</strong> on any item to add it at exact cost after markup is applied.</div></>}
      {items.map((li,idx)=>{
        const cost=Number(li.costLow)||0;
        const totalStr=cost>0?fmt(cost):"—";
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:"200px 1fr 120px 80px",gap:8,marginBottom:8,alignItems:"center"}}>
          <input value={li.description} onChange={e=>setItem(li.id,"description",e.target.value)} placeholder="e.g. 9ct white gold" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px"}}/>
          <input value={li.detail} onChange={e=>setItem(li.id,"detail",e.target.value)} placeholder="e.g. 5g × $110/g" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",color:WG}}/>
          <input type="number" value={li.costLow} onChange={e=>setItem(li.id,"costLow",e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px",textAlign:"right"}}/>
          <div style={{fontSize:13,fontWeight:700,color:INK,textAlign:"right",whiteSpace:"nowrap"}}>{totalStr}</div>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            <button
              onClick={()=>setItem(li.id,"noMarkup",!li.noMarkup)}
              title={li.noMarkup?"No markup applied — click to include in markup":"Click to exclude this item from markup"}
              style={{background:li.noMarkup?"#7B5EA7":"transparent",border:`1px solid ${li.noMarkup?"#7B5EA7":BD}`,borderRadius:2,padding:"1px 5px",fontSize:9,fontWeight:700,color:li.noMarkup?WHITE:WG,cursor:"pointer",letterSpacing:"0.04em",lineHeight:"16px",whiteSpace:"nowrap"}}>
              {li.noMarkup?"NO MU":"MU"}
            </button>
            <button onClick={()=>removeItem(li.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:17,padding:0,lineHeight:1}}>×</button>
            {idx>0&&<button onClick={()=>moveItem(li.id,-1)} style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:13,padding:"0 2px"}}>↑</button>}
          </div>
        </div>;})}
      {/* Manufacturing-markup accent stones — folded into the jewellery costs list (editable) */}
      {mfgAccents.map(li=>{
        const cost=Number(li.costLow)||0;
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:"200px 1fr 120px 80px",gap:8,marginBottom:8,alignItems:"center"}}>
          <input value={li.description} onChange={e=>setAccentItem(li.id,"description",e.target.value)} placeholder="e.g. 4 × pear sapphire" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
            <span style={{background:"#EEF4FB",color:"#3B6E8F",fontSize:8,fontWeight:800,padding:"3px 5px",borderRadius:3,letterSpacing:"0.04em",flexShrink:0}} title="Accent / fancy stone">ACCENT</span>
            <input value={li.detail||""} onChange={e=>setAccentItem(li.id,"detail",e.target.value)} placeholder="notes (optional)" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",color:WG,flex:1,minWidth:0}}/>
            <select value={li.markupMode||"mfg"} onChange={e=>setAccentItem(li.id,"markupMode",e.target.value)} title="Markup basis — switch to natural/lab to price it separately" style={{...SS.inp,marginTop:0,fontSize:11,padding:"5px 6px",width:"auto",flexShrink:0}}>
              <option value="mfg">Mfg</option>
              <option value="natural">Natural</option>
              <option value="lab">Lab</option>
            </select>
          </div>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>$</span>
            <input type="number" value={li.costLow} onChange={e=>setAccentItem(li.id,"costLow",e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px 7px 22px",textAlign:"right",borderColor:cost>0?"#8EB5D4":BD,fontWeight:cost>0?700:400}}/>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"center",justifyContent:"flex-end"}}>
            <button onClick={()=>removeAccentItem(li.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:17,padding:0,lineHeight:1}}>×</button>
          </div>
        </div>;})}
      {/* Sourced centre / feature stone — folded into the jewellery costs list (priced on the stone markup) */}
      {stoneMode==="sourcing"&&stoneType&&stoneItems.map(li=>{
        const stoneCost=Number(li.cost)||Number(li.costLow)||0;
        const accent=stoneType==="lab"?"#7B5EA7":"#3B6E8F";
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:"200px 1fr 120px 80px",gap:8,marginBottom:8,alignItems:"center"}}>
          <input value={li.description} onChange={e=>setStonItem(li.id,"description",e.target.value)} placeholder="e.g. 1.52ct oval sapphire" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",borderColor:stoneType==="lab"?"#C4A8F0":"#8EB5D4"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
            <span style={{background:accent+"18",color:accent,fontSize:8,fontWeight:800,padding:"3px 5px",borderRadius:3,letterSpacing:"0.04em",flexShrink:0,whiteSpace:"nowrap"}} title="Centre / feature stone — priced on the stone markup">CENTRE · {stoneType==="lab"?"LAB":"NAT"}</span>
            <input value={li.detail} onChange={e=>setStonItem(li.id,"detail",e.target.value)} placeholder="cert / source / notes" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 10px",color:WG,flex:1,minWidth:0}}/>
          </div>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>$</span>
            <input type="number" value={li.cost||""} onChange={e=>setStonItem(li.id,"cost",e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px 7px 22px",textAlign:"right",borderColor:stoneCost>0?(stoneType==="lab"?"#C4A8F0":"#8EB5D4"):BD,fontWeight:stoneCost>0?700:400}}/>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"center",justifyContent:"flex-end"}}>
            <button onClick={()=>removeStoneItem(li.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:17,padding:0,lineHeight:1}}>×</button>
          </div>
        </div>;})}
      <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap"}}>
        <button onClick={()=>setItems(p=>[...p,blankItem()])} style={{background:"none",border:`1px dashed ${GOLD}`,borderRadius:4,padding:"6px 14px",color:GOLD,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add item</button>
        <button onClick={openPricing} style={{background:GOLD_L,border:`1px solid ${GOLD}`,borderRadius:4,padding:"6px 14px",color:GOLD_D,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⊕ Pricing DB</button>
        <button onClick={()=>setAccentModal(true)} style={{background:"#EEF4FB",border:"1px solid #8EB5D4",borderRadius:4,padding:"6px 14px",color:"#3B6E8F",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Accent / fancy stone</button>
        {stoneMode==="sourcing"&&stoneType&&<button onClick={addStoneItem} style={{background:(stoneType==="lab"?"#7B5EA7":"#3B6E8F")+"18",border:`1px solid ${stoneType==="lab"?"#7B5EA7":"#3B6E8F"}`,borderRadius:4,padding:"6px 14px",color:stoneType==="lab"?"#7B5EA7":"#3B6E8F",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Centre stone</button>}
      </div>
      <div style={{fontSize:11,color:WG,margin:"8px 0 20px",lineHeight:1.5}}>Custom coloured or fancy-cut stones aren't in the pricing DB — add them with <strong style={{color:"#3B6E8F"}}>+ Accent / fancy stone</strong>. They default to manufacturing markup and join the costs above; switch a pricey one to <strong>Natural</strong>/<strong>Lab</strong> stone markup to price it separately below.</div>
      {validItems.length>0&&<div style={{marginBottom:28}}>
        <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Markup preview</div>
        <MarkupSummary {...calc} large/>
        {/* Manual markup override */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12,flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:700,color:WG}}>Markup multiplier</span>
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
        <div style={{fontSize:11,fontWeight:700,color:"#7B5EA7",textTransform:"uppercase",letterSpacing:"0.08em"}}>Accent stones on stone markup</div>
        <div style={{fontSize:11,color:WG,margin:"3px 0 12px",lineHeight:1.55}}>These are priced like the centre stone — your cost × the natural/lab stone tier + GST — not the jewellery markup. Switch one back to <strong>Mfg markup</strong> to fold it into the jewellery costs above.</div>
        <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr 150px 110px 36px",gap:8,marginBottom:6,padding:"0 2px"}}>
          {["Stone","Notes / detail","Markup","Your cost",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>)}
        </div>
        {stoneAccents.map(li=>{
          const cost=Number(li.costLow)||0;
          const mode=li.markupMode||"mfg";
          const sc=cost>0?calcStoneQuote([{cost:li.costLow}],mode==="lab"?labStoneMarkup:naturalStoneMarkup):null;
          return <div key={li.id} style={{display:"grid",gridTemplateColumns:"1.3fr 1fr 150px 110px 36px",gap:8,marginBottom:8,alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:INK,padding:"7px 0"}}>{li.description||<span style={{color:WG,fontStyle:"italic"}}>—</span>}
              <div style={{fontSize:10,color:sc?(sc.bracket?"#7B5EA7":WARN):WG,marginTop:1}}>{sc?(sc.bracket?`→ ${fmtR(sc.clientTotal)} to client (×${sc.mult} + GST)`:"cost outside stone table"):""}</div>
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
                style={{...SS.inp,marginTop:0,fontSize:13,padding:"7px 8px 7px 22px",textAlign:"right",borderColor:cost>0?"#C4A8F0":BD,fontWeight:cost>0?700:400}}/>
            </div>
            <button onClick={()=>removeAccentItem(li.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:17,padding:0,lineHeight:1,textAlign:"center"}}>×</button>
          </div>;
        })}
      </div>}

      {/* ── Centre / feature stone divider ── */}
      <div style={{display:"flex",alignItems:"center",gap:14,margin:"4px 0 20px"}}>
        <div style={{fontSize:12,fontWeight:700,color:INK,whiteSpace:"nowrap"}}>Centre / feature stone?</div>
        <div style={{flex:1,height:1,background:BD}}/>
      </div>

      {/* Stone mode — inline pill selector */}
      <div style={{display:"flex",gap:8,marginBottom:stoneMode==="none"?0:22}}>
        {[["none","No stone"],["client","Client supplying their own"],["sourcing","We are sourcing the stone"]].map(([val,label])=>(
          <button key={val} onClick={()=>{setStoneMode(val);if(val!=="sourcing")setStoneItems([]);if(val!=="sourcing")setStoneType("");}} style={{
            padding:"8px 20px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            border:`1.5px solid ${stoneMode===val?(val==="sourcing"?"#7B5EA7":val==="client"?"#3B6E8F":INK):BD}`,
            background:stoneMode===val?(val==="sourcing"?"#7B5EA722":val==="client"?"#3B6E8F22":"#1A1A1A11"):"transparent",
            color:stoneMode===val?(val==="sourcing"?"#7B5EA7":val==="client"?"#3B6E8F":INK):WG,
            transition:"all 0.12s"
          }}>{label}</button>
        ))}
      </div>

      {/* Client's own stone */}
      {stoneMode==="client"&&<div style={{background:"#EEF4FB",border:"1px solid #B8D4EC",borderRadius:4,padding:"14px 16px",marginBottom:4}}>
        <div style={{fontSize:12,color:"#2C5282",marginBottom:10,lineHeight:1.6}}>No stone cost will be added to this quote. Record the stone details below for your files.</div>
        <Input label="Stone description (for records)" value={stoneNotes} onChange={setStoneNotes} as="textarea" rows={2} placeholder="e.g. Client's own 1.52ct oval sapphire, untreated, GIA cert #12345. Supplied at client's risk."/>
      </div>}

      {/* Studio sourcing */}
      {stoneMode==="sourcing"&&<div>
        {/* Stone type selector */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Stone type</div>
          <div style={{display:"flex",gap:10}}>
            {[["natural","🌍  Natural Diamond / Gemstone","3.00× – 1.20×","#3B6E8F"],["lab","⚗️  Lab-Grown Diamond / Gemstone","4.25× – 1.20×","#7B5EA7"]].map(([val,label,range,col])=>(
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
          <div style={{fontSize:12,color:WG,marginBottom:12,lineHeight:1.5}}>Add the centre stone with <strong style={{color:stoneType==="lab"?"#7B5EA7":"#3B6E8F"}}>+ Centre stone</strong> in the jewellery costs list above — it's tagged <strong>CENTRE</strong> and priced on the {stoneType==="lab"?"lab-grown":"natural"} stone markup below.</div>
          {stoneCalc&&<div style={{marginBottom:4}}>
            <div style={{fontSize:11,fontWeight:700,color:stoneType==="lab"?"#7B5EA7":"#3B6E8F",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>
              {stoneType==="lab"?"Lab-Grown stone":"Natural stone"} — markup + GST
            </div>
            <StoneMarkupSummary calc={stoneCalc}/>
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
                  ...(accentStoneTotal>0?[["Accent stones",fmtR(accentStoneTotal),"#7B5EA7","+ "]]:[]),
                ]:[]),
                ...(stoneMode==="sourcing"&&stoneCalc?[["Stone",fmtR(stoneCalc.clientTotal),stoneType==="lab"?"#7B5EA7":"#3B6E8F","+ "]]:
                   stoneMode==="client"?[["Stone","Client supplying",WG,"+ "]]:
                   []),
                [manualOn?"Total — manual price":"Total",fmtR(manualOn?Number(manualTotal):grandTotal),OK,"= "],
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

      {/* ── Manual quoted price — for verbal phone / in-person quotes ── */}
      <div style={{borderTop:`1px solid ${BD}`,marginTop:16,paddingTop:18,marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em"}}>Manual quoted price</div>
            <div style={{fontSize:11,color:WG,marginTop:3,lineHeight:1.5}}>Quoted verbally over the phone or in person? Enter the final price (inc GST) — it becomes the quote total everywhere, no line items needed.</div>
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
        <Btn ghost onClick={()=>setView("jobDetail_"+jobId)}>Cancel</Btn>
        <Btn onClick={()=>save_(isEditing?existingQuote.status:"Draft")}>{isEditing?"Save changes":"Save quote"}</Btn>
      </div>
    </Card>

    {pricingModal&&<div onClick={e=>{if(e.target===e.currentTarget)closePricing();}}
      style={{position:"fixed",inset:0,background:"rgba(26,23,20,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(3px)",padding:16}}>
      <div style={{background:WHITE,borderRadius:8,width:"min(1240px,97vw)",height:"min(880px,94vh)",display:"flex",flexDirection:"column",border:`1px solid ${BD}`,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",overflow:"hidden"}}>

        {/* ── Header: title + global search (fixed) ── */}
        <div style={{flexShrink:0,padding:"16px 24px 14px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:800,color:INK}}>Add from pricing DB</h2>
            <button onClick={closePricing} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:WG,lineHeight:1,padding:0}}>×</button>
          </div>
          <input autoFocus value={pSearch} onChange={e=>setPSearch(e.target.value)} placeholder="Search the whole pricing DB…  (Esc closes)" style={{...SS.inp,marginTop:0}}/>
        </div>

        {/* ── Body: category sidebar + item list ── */}
        <div style={{flex:1,display:"flex",minHeight:0}}>
          <div style={{width:188,flexShrink:0,borderRight:`1px solid ${BD}`,overflowY:"auto",padding:"10px 8px",background:PARCH}}>
            {["All",...PCAT.filter(c=>c!=="Accent Stones")].map(cat=>{
              const n=cat==="All"?pricing.filter(p=>p.category!=="Accent Stones").length:pricing.filter(p=>p.category===cat).length;
              const active=!pSearching&&pCat===cat;
              return <button key={cat} onClick={()=>{setPCat(cat);setSelCAD(null);setPSearch("");}}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,width:"100%",textAlign:"left",padding:"8px 12px",borderRadius:6,border:"none",background:active?GOLD:"transparent",color:active?WHITE:INK,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:2}}>
                <span>{cat}</span>
                {n>0&&<span style={{fontSize:10,fontWeight:700,color:active?"rgba(255,255,255,0.75)":WG}}>{n}</span>}
              </button>;
            })}
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,padding:"0 24px"}}>
            {/* Quick manual amount — add a custom labelled line */}
            <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:10,background:PARCH,border:`1px solid ${BD}`,borderRadius:8,padding:"8px 12px",margin:"12px 0 10px"}}>
              <span style={{background:"#3B6E8F",color:WHITE,fontSize:10,fontWeight:700,padding:"4px 9px",borderRadius:5,letterSpacing:"0.06em",whiteSpace:"nowrap"}}>MANUAL AMOUNT</span>
              <input value={manLabel} onChange={e=>setManLabel(e.target.value)} placeholder="Label (e.g. Labour)" onKeyDown={e=>{if(e.key==="Enter")addManual();}} style={{...SS.inp,marginTop:0,flex:1}}/>
              <div style={{position:"relative",width:110,flexShrink:0}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
                <input type="number" value={manAmt} onChange={e=>setManAmt(e.target.value)} min="0" step="0.01" placeholder="0.00" onKeyDown={e=>{if(e.key==="Enter")addManual();}} style={{...SS.inp,marginTop:0,padding:"9px 10px 9px 22px",textAlign:"right",width:"100%"}}/>
              </div>
              <Btn sm onClick={addManual}>Add</Btn>
            </div>

            {!pSearching&&pCat===CENTRE_SET_CAT
              ? <div style={{flex:1,overflowY:"auto",paddingBottom:14}}><CentreStonePicker onAdd={addCentreSetting} centreRates={centreRates}/></div>
              : !pSearching&&pCat==="CAD Design"
              ? <div style={{flex:1,overflowY:"auto",paddingBottom:14}}><CADQuotePicker pricing={pricing} selCAD={selCAD} setSelCAD={setSelCAD} pQty={pQty} setPQty={setPQty} addFromDB={addFromDB}/></div>
              : <div style={{flex:1,overflowY:"auto",paddingBottom:14}}>
                  {!pSearching&&pCat==="3D Print & Cast"&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",marginBottom:8,background:GOLD_L+"66",border:`1px solid ${GOLD}55`,borderRadius:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontSize:12,fontWeight:700,color:GOLD_D}}>Manual override price</div>
                      <div style={{fontSize:11,color:WG,marginTop:2}}>Add your own 3D print &amp; cast total instead of the per-piece figures.</div>
                    </div>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
                      <input type="number" value={pcOverride} min="0" step="0.01" placeholder="0.00"
                        onChange={e=>setPcOverride(e.target.value)}
                        style={{...SS.inp,marginTop:0,width:130,padding:"8px 10px 8px 22px",fontSize:14,fontWeight:700,textAlign:"right"}}/>
                    </div>
                    <Btn sm onClick={addCustomPrintCast}>Add to quote</Btn>
                  </div>}
                  {(()=>{
                    const visibleItems=fp.filter(item=>!(item.category==="CAD Design"&&item.cadTier)&&item.category!=="Accent Stones");
                    const isRepairsView=!pSearching&&pCat===REPAIRS_CAT;
                    const showCat=pSearching||pCat==="All";
                    let lastGroup=null;
                    return visibleItems.map(item=>{
                    const showGroupHeader=isRepairsView&&item.group&&item.group!==lastGroup;
                    if(showGroupHeader)lastGroup=item.group;
                    const isDiamond=DIAMOND_CATS.includes(item.category);
                    const isSetting=item.category==="Basic Setting"||item.category==="Complex Setting";
                    const isPrintCast=item.category==="3D Print & Cast";
                    const isCADRevision=item.cadRevision;
                    const isFixedJob=item.unit==="job"&&!isCADRevision;
                    const needsQty=!isFixedJob&&!item.cadTier;
                    const qty=pQty[item.id]||"";
                    const qtyStep=item.unit==="g"?"0.1":"1";
                    const qtyLabel=item.unit==="g"?"Grams":item.unit==="hr"?"Hours":item.unit==="pair"?"Pairs":item.unit==="item"?"Qty":isPrintCast?"Pieces":isCADRevision?"Hours":isDiamond||isSetting?"Stones":"Qty";
                    const previewCost=needsQty&&qty&&Number(qty)>0?(item.baseCost*Number(qty)).toFixed(2):null;
                    const mode=pMode[item.id]||"qty";
                    const amtMode=mode==="amt";
                    const addNow=()=>amtMode?addManualAmount(item,qty):addFromDB(item,qty||1);
                    const timesAdded=addedIds[item.id]||0;
                    const flashing=pFlash===item.id;
                    const row=<div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BD}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                          <span style={{fontWeight:600,fontSize:13,color:INK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(isDiamond||isSetting)?`${item.sizeMm}mm`:item.name}</span>
                          {timesAdded>0&&<span style={{background:flashing?OK:OK+"1A",color:flashing?WHITE:OK,fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:10,letterSpacing:"0.05em",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.25s"}}>✓ {timesAdded>1?`ON QUOTE ×${timesAdded}`:"ON QUOTE"}</span>}
                        </div>
                        <div style={{fontSize:11,color:WG,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {showCat?`${item.category} · `:""}
                          {isDiamond?`${item.caratWeight}ct · ${fmt(item.baseCost)}/stone · ${fmt(item.pricePerCarat)}/ct`
                          :isSetting?`stone fits ${item.caratWeight}ct · ${fmt(item.baseCost)}/stone setting`
                          :isPrintCast?`${fmt(item.baseCost)}/piece`
                          :isCADRevision?`${fmt(item.baseCost)}/hr · additional major revisions`
                          :`${fmt(item.baseCost)} per ${item.unit}`}
                        </div>
                      </div>
                      {isFixedJob
                        ?<>
                          <span style={{fontSize:13,fontWeight:700,color:INK,whiteSpace:"nowrap"}}>{fmt(item.baseCost)}</span>
                          <Btn sm onClick={()=>addFromDB(item,1)}>Add</Btn>
                        </>
                        :needsQty&&<>
                          <div title={amtMode?"Entering a manual $ amount — click # to enter "+qtyLabel.toLowerCase():"Entering "+qtyLabel.toLowerCase()+" — click $ to enter a manual amount"}
                            style={{display:"flex",borderRadius:6,overflow:"hidden",border:`1px solid ${BD}`,flexShrink:0}}>
                            {[["qty","#"],["amt","$"]].map(([m,lab])=>(
                              <button key={m} onClick={()=>setPMode(p=>({...p,[item.id]:m}))}
                                style={{padding:"4px 9px",border:"none",background:mode===m?INK:"transparent",color:mode===m?WHITE:WG,fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit",lineHeight:"16px"}}>{lab}</button>
                            ))}
                          </div>
                          <input type="number" value={qty} min="0" step={amtMode?"0.01":qtyStep}
                            onChange={e=>setPQty(p=>({...p,[item.id]:e.target.value}))}
                            onKeyDown={e=>{if(e.key==="Enter")addNow();}}
                            placeholder={amtMode?"$ amount":qtyLabel}
                            style={{...SS.inp,marginTop:0,width:96,padding:"6px 9px",fontSize:13,textAlign:"right",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:800,color:OK,whiteSpace:"nowrap",width:84,textAlign:"right",flexShrink:0}}>{amtMode?(Number(qty)>0?`= ${fmt(qty)}`:""):previewCost?`= ${fmt(previewCost)}`:""}</span>
                          <Btn sm onClick={addNow}>Add</Btn>
                        </>}
                    </div>;
                    if(!showGroupHeader)return row;
                    return [
                      <div key={item.id+"_g"} style={{padding:"10px 0 2px"}}>
                        <span style={{fontSize:10,fontWeight:800,color:GOLD_D,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.group}</span>
                      </div>,
                      row
                    ];
                  });
                  })()}
                  {fp.length===0&&<div style={{color:WG,fontSize:14,padding:"10px 0"}}>No items found.</div>}
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
            <span style={{fontSize:12,color:WG}}>Quote total: <strong style={{color:OK,fontSize:15}}>{fmtR(manualOn?Number(manualTotal):grandTotal)}</strong> inc GST</span>
            <Btn onClick={closePricing}>Done</Btn>
          </div>
        </div>
      </div>
    </div>}

    {accentModal&&<AccentStoneModal
      pricing={pricing} setPricing={setPricing} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup}
      onAdd={item=>{setAccentItems(p=>[...p,{...item,id:uid(),accentStone:true,noMarkup:false,markupMode:item.markupMode||"mfg"}]);setAccentModal(false);}}
      onClose={()=>setAccentModal(false)}
    />}
  </div>;
}

// ── Multi-option proposals (staff side) ───────────────────────────────────
// A proposal bundles several quotes as "options" for one job and produces a public
// link the client opens to pick one and accept online. See PublicProposalPage below.
function JobProposals({job,client,quotes,proposals,setProposals,setQuotes,biz,markupTable,payments=[]}){
  const jobProposals=(proposals||[]).filter(p=>p.jobId===job?.id).slice().reverse();
  const [builder,setBuilder]=useState(false);
  const [sel,setSel]=useState([]);            // chosen option quote ids
  const [recommended,setRecommended]=useState("");
  const [intro,setIntro]=useState("");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState("");
  const [checking,setChecking]=useState("");
  const [selectMode,setSelectMode]=useState("single");   // "single" = pick one, "multi" = pick any (bundle)

  // Only quotes with a resolvable price can be sent as options
  const optionable=(quotes||[]).filter(q=>{
    const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
    return quoteIsManual(q)||!(calc.base>0&&!calc.bracket&&!calc.overridden);
  });
  const linkFor=p=>`${window.location.origin}/?p=${p.token}`;
  const save=next=>{setProposals(next);persist(K.pp,next);};

  const toggle=id=>setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const openBuilder=()=>{setSel([]);setRecommended("");setIntro("");setSelectMode("single");setBuilder(true);};

  const createAndShare=async()=>{
    if(!sel.length)return alert("Pick at least one quote to include as an option.");
    if(!supabaseEnabled)return alert("Online proposals need the cloud — you appear to be in local-only mode.");
    setBusy(true);
    const id=uid(),token=proposalToken();
    const orderedIds=optionable.filter(q=>sel.includes(q.id)).map(q=>q.id);
    const proposal={id,jobId:job.id,token,optionIds:orderedIds,recommendedId:selectMode==="multi"?"":(recommended||""),selectMode,intro:intro.trim(),createdAt:today(),status:"sent",acceptedQuoteId:null,acceptedName:"",acceptedAt:null};
    const snapshot=buildProposalSnapshot({proposal,job,client,biz,quotes,markupTable,payments});
    const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).insert({token,data:snapshot,status:"sent",created_at:new Date().toISOString()});
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
      setQuotes(prev=>{const n=prev.map(q=>q.id===acceptedQuoteId?{...q,status:"Approved"}:(q.jobId===job.id&&q.status==="Approved"?{...q,status:"Declined"}:q));persist(K.qu,n);return n;});
    }else if(!silent&&data.status!=="accepted"){
      alert("No acceptance yet — the client hasn't accepted this proposal.");
    }
  };

  // Auto-check sent proposals for acceptance when the job is opened
  useEffect(()=>{jobProposals.filter(p=>p.status==="sent").forEach(p=>checkAcceptance(p,true));},[job?.id]);   // eslint-disable-line
  // Keep sent proposals' link snapshots current (e.g. payments recorded since publishing) when the job opens
  useEffect(()=>{
    if(!supabaseEnabled||!supabase)return;
    jobProposals.filter(p=>p.token&&p.status==="sent").forEach(p=>{
      const snap=buildProposalSnapshot({proposal:p,job,client,biz,quotes,markupTable,payments});
      supabase.from(PUBLIC_PROPOSALS_TABLE).update({data:snap}).eq("token",p.token).then(()=>{}).catch(()=>{});
    });
  },[job?.id]);   // eslint-disable-line

  const delProposal=async p=>{
    if(!confirm("Delete this proposal? The client's link will stop working."))return;
    if(supabaseEnabled)try{await supabase.from(PUBLIC_PROPOSALS_TABLE).delete().eq("token",p.token);}catch(e){}
    save(proposals.filter(x=>x.id!==p.id));
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
      return <div key={p.id} style={{border:`1px solid ${accepted?OK+"66":BD}`,borderRadius:10,padding:"12px 14px",marginBottom:10,background:accepted?OK+"08":WHITE}}>
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
            {!accepted&&<>
              <button onClick={()=>copyLink(p)} style={{background:copied===p.id?OK:GOLD_L,border:`1px solid ${copied===p.id?OK:GOLD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:copied===p.id?WHITE:GOLD_D,cursor:"pointer",fontFamily:"inherit"}}>{copied===p.id?"✓ Copied":"Copy link"}</button>
              <button onClick={()=>window.open(linkFor(p),"_blank")} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>Preview</button>
              <button onClick={()=>checkAcceptance(p,false)} style={{background:"none",border:`1px solid ${BD}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,color:WG,cursor:"pointer",fontFamily:"inherit"}}>{checking===p.id?"Checking…":"Check for acceptance"}</button>
            </>}
            <button onClick={()=>delProposal(p)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:17,padding:0,lineHeight:1}}>×</button>
          </div>
        </div>
      </div>;
    })}

    {builder&&<Modal title="New proposal" onClose={()=>setBuilder(false)} wide>
      <div style={{fontSize:13,color:WG,marginBottom:14,lineHeight:1.6}}>Pick the quote(s) to offer as options, then choose how the client selects.</div>
      {/* How the client chooses */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        {[["single","Choose one","The client picks a single option — for alternatives (e.g. Good / Better / Best)."],["multi","Choose any (bundle)","The client can tick more than one — for sets they buy together (e.g. two wedding bands). Total = the chosen options combined."]].map(([m,t,d])=>(
          <button key={m} onClick={()=>setSelectMode(m)} style={{textAlign:"left",padding:"12px 14px",borderRadius:8,border:`2px solid ${selectMode===m?GOLD:BD}`,background:selectMode===m?GOLD_L+"55":WHITE,cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{fontSize:13,fontWeight:700,color:selectMode===m?GOLD_D:INK,marginBottom:3}}>{selectMode===m?"● ":"○ "}{t}</div>
            <div style={{fontSize:11,color:WG,lineHeight:1.5}}>{d}</div>
          </button>
        ))}
      </div>
      <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Options</div>
      {optionable.map(q=>{
        const on=sel.includes(q.id);
        return <div key={q.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",border:`1px solid ${on?GOLD:BD}`,borderRadius:8,marginBottom:8,background:on?GOLD_L+"55":WHITE}}>
          <input type="checkbox" checked={on} onChange={()=>toggle(q.id)} style={{width:16,height:16,cursor:"pointer",accentColor:GOLD}}/>
          <div style={{flex:1,cursor:"pointer"}} onClick={()=>toggle(q.id)}>
            <div style={{fontWeight:700,fontSize:14,color:INK}}>{quoteLabel(q)}</div>
            <div style={{fontSize:12,color:WG,marginTop:1}}>{fmtR(quoteGrandTotal(q,markupTable))} inc GST · {q.status}</div>
          </div>
          {selectMode!=="multi"&&<button onClick={()=>setRecommended(r=>r===q.id?"":q.id)} disabled={!on}
            title="Mark as recommended"
            style={{background:recommended===q.id?GOLD:"none",border:`1px solid ${recommended===q.id?GOLD:BD}`,borderRadius:6,padding:"5px 11px",fontSize:12,fontWeight:700,color:recommended===q.id?WHITE:(on?GOLD_D:WG),cursor:on?"pointer":"not-allowed",fontFamily:"inherit",opacity:on?1:0.5}}>★ Recommend</button>}
        </div>;
      })}
      <div style={{marginTop:14}}>
        <label style={{...SS.lbl,marginBottom:6}}>Intro message <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(optional — shown at the top of the proposal)</span></label>
        <textarea value={intro} onChange={e=>setIntro(e.target.value)} rows={3} placeholder={`Dear ${client?.name||"…"}, thank you for your enquiry. Please find your options below.`} style={{...SS.inp,marginTop:0,resize:"vertical",lineHeight:1.6}}/>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:18,alignItems:"center"}}>
        <span style={{fontSize:12,color:WG,marginRight:"auto"}}>{sel.length} option{sel.length!==1?"s":""} selected</span>
        <Btn ghost onClick={()=>setBuilder(false)}>Cancel</Btn>
        <Btn onClick={createAndShare} disabled={busy||!sel.length}>{busy?"Publishing…":"Publish & copy link"}</Btn>
      </div>
    </Modal>}
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
    ...(hasPrices?[["Repair total · inc GST",fmtR(snap.total)]]:[]),
  ];
  const accepted=responded&&decision!=="declined";
  return <div style={{maxWidth:760,margin:"0 auto"}}>
    {/* Header */}
    <div style={{background:INK,borderRadius:`${RADIUS}px ${RADIUS}px 0 0`,padding:"36px 44px 32px",color:WHITE,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:14}}>Repair Receipt</div>
        {b.logo
          ?<div style={{background:WHITE,borderRadius:10,padding:"8px 14px",display:"inline-block"}}><img src={b.logo} alt={b.name||"Logo"} style={{maxWidth:200,maxHeight:58,objectFit:"contain",display:"block"}}/></div>
          :<div style={{fontSize:26,fontWeight:800}}>{b.name||"Our Studio"}</div>}
        <div style={{marginTop:14,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.8}}>
          {b.address&&<div>{b.address}</div>}
          {(b.phone||b.email)&&<div>{[b.phone,b.email].filter(Boolean).join("  ·  ")}</div>}
          {b.abn&&<div style={{color:"rgba(255,255,255,0.32)"}}>ABN {b.abn}</div>}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:19,fontWeight:800,letterSpacing:"0.04em"}}>#{snap.ref}</div>
      </div>
    </div>

    <div style={{background:WHITE,borderRadius:`0 0 ${RADIUS}px ${RADIUS}px`,border:`1px solid ${BD}`,borderTop:"none",padding:"32px 44px 38px",boxShadow:SHADOW}}>
      {/* Summary strip */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${sum.length},1fr)`,gap:1,background:BD,border:`1px solid ${BD}`,borderRadius:10,overflow:"hidden",marginBottom:28}}>
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
      {hasPrices&&<div style={{display:"flex",justifyContent:"flex-end",alignItems:"baseline",gap:16,marginTop:18}}>
        <span style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em"}}>Repair total (inc GST)</span>
        <span style={{fontSize:22,fontWeight:800,color:INK}}>{fmtR(snap.total)}</span>
      </div>}

      {snap.instructions&&<div style={{fontSize:13,color:INK,lineHeight:1.7,background:PARCH,borderLeft:`3px solid ${GOLD}`,borderRadius:"0 8px 8px 0",padding:"14px 18px",margin:"26px 0 0"}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Client instructions</div>{snap.instructions}
      </div>}

      {/* Confirm / decline */}
      {responded
        ?<div style={{background:(accepted?OK:DANGER)+"12",border:`1px solid ${(accepted?OK:DANGER)}55`,borderRadius:12,padding:"18px 20px",margin:"28px 0 4px"}}>
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
              style={{flex:1,minWidth:160,background:(!name.trim()||busy)?BD:INK,color:WHITE,border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:800,cursor:(!name.trim()||busy)?"not-allowed":"pointer",fontFamily:"inherit"}}>{busy?"Submitting…":"✓ Accept repair"}</button>
            <button onClick={()=>respond("declined")} disabled={!name.trim()||busy}
              style={{background:"none",color:DANGER,border:`1px solid ${DANGER}66`,borderRadius:10,padding:"14px 20px",fontSize:14,fontWeight:700,cursor:(!name.trim()||busy)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(!name.trim()||busy)?0.5:1}}>Decline</button>
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
      <div style={{textAlign:"center",fontSize:10,color:WG,marginTop:26}}>All prices inclusive of GST · Quoted in AUD</div>
    </div>
  </div>;
}

// Client-facing tax invoice (rendered inside PublicProposalPage when kind==="invoice").
function PublicInvoiceBody({snap}){
  const b=snap.biz||{};
  const itemised=!snap.descriptionOverride?.trim();
  const bank=[["Bank",b.bankName],["Account name",b.bankAccountName],["BSB",b.bankBSB],["Account",b.bankAccount],["Reference",snap.number]].filter(([,v])=>v);
  return <div style={{maxWidth:680,margin:"0 auto"}}>
    {/* Header */}
    <div style={{background:INK,borderRadius:`${RADIUS}px ${RADIUS}px 0 0`,padding:"32px 32px 26px",color:WHITE,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:12}}>Tax Invoice</div>
        {b.logo
          ?<div style={{background:WHITE,borderRadius:10,padding:"8px 14px",display:"inline-block"}}><img src={b.logo} alt={b.name||"Logo"} style={{maxWidth:200,maxHeight:54,objectFit:"contain",display:"block"}}/></div>
          :<div style={{fontSize:24,fontWeight:800}}>{b.name||"Our Studio"}</div>}
        <div style={{marginTop:12,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.7}}>
          {b.address&&<div>{b.address}</div>}
          {(b.phone||b.email)&&<div>{[b.phone,b.email].filter(Boolean).join("  ·  ")}</div>}
          {b.abn&&<div style={{color:"rgba(255,255,255,0.32)"}}>ABN {b.abn}</div>}
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
      {snap.jobType&&<div style={{fontSize:13,color:WG,marginTop:2}}>{snap.jobType}</div>}

      {/* Lines */}
      <div style={{marginTop:22,borderTop:`1px solid ${BD}`}}>
        {itemised
          ?(snap.lineItems||[]).map((li,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",gap:16,padding:"12px 0",borderBottom:`1px solid ${BD}`}}>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:INK}}>{li.description}</div>{li.detail&&<div style={{fontSize:12,color:WG,marginTop:2}}>{li.detail}</div>}</div>
              <div style={{fontSize:14,fontWeight:700,color:INK,whiteSpace:"nowrap"}}>{fmt(li.amount)}</div>
            </div>))
          :<div style={{display:"flex",justifyContent:"space-between",gap:16,padding:"12px 0",borderBottom:`1px solid ${BD}`}}>
            <div style={{flex:1,fontSize:14,color:INK,lineHeight:1.6}}>{snap.descriptionOverride}</div>
            <div style={{fontSize:14,fontWeight:700,color:INK,whiteSpace:"nowrap"}}>{fmt(snap.totalIncGST)}</div>
          </div>}
      </div>

      {/* Totals */}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <div style={{minWidth:240}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"3px 0"}}><span>Includes GST</span><span>{fmt(snap.gst)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:17,fontWeight:800,color:INK,borderTop:`2px solid ${INK}`,marginTop:8,paddingTop:10}}><span>Total (inc GST)</span><span>{fmt(snap.totalIncGST)}</span></div>
          {snap.paidTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:OK,padding:"6px 0 3px"}}><span>Paid to date</span><span>−{fmt(snap.paidTotal)}</span></div>}
          {snap.staged
            ?<>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:snap.dueNow>0?WARN:OK,borderTop:`1px solid ${BD}`,marginTop:4,paddingTop:8}}><span>Due now</span><span>{fmt(snap.dueNow)}</span></div>
              {snap.remainingAfter>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:WG,padding:"4px 0 0"}}><span>Balance remaining (payable later)</span><span>{fmt(snap.remainingAfter)}</span></div>}
            </>
            :snap.paidTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:snap.balance>0?WARN:OK}}><span>Balance due</span><span>{fmt(snap.balance)}</span></div>}
        </div>
      </div>
      {snap.paidTotal>0&&<div style={{textAlign:"right",fontSize:11,color:WG,marginTop:4}}>as at {fmtDate(snap.asAt)}</div>}

      {/* Payment details */}
      {bank.length>0&&<div style={{marginTop:24,background:PARCH,border:`1px solid ${BD}`,borderRadius:12,padding:"18px 20px"}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:12}}>Payment — direct deposit</div>
        <div style={{fontSize:14}}>
          {bank.map(([k,v])=><div key={k} style={{display:"flex",gap:16,padding:"3px 0"}}><div style={{color:WG,width:110,flexShrink:0}}>{k}</div><div style={{fontWeight:k==="Reference"?800:600,color:INK}}>{v}</div></div>)}
        </div>
        <div style={{fontSize:12,color:WG,marginTop:12,lineHeight:1.5}}>Please use <strong style={{color:INK}}>{snap.number}</strong> as the payment reference so we can match your payment.</div>
      </div>}
      <div style={{textAlign:"center",fontSize:10,color:WG,marginTop:24}}>All amounts in AUD · GST inclusive</div>
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

  const wrap=(inner)=><div style={{minHeight:"100vh",background:CREAM,fontFamily:"'DM Sans',sans-serif",padding:"24px 16px",boxSizing:"border-box"}}>{inner}</div>;
  if(state==="loading")return wrap(<div style={{textAlign:"center",color:WG,fontSize:14,marginTop:80}}>Loading your proposal…</div>);
  if(state==="error")return wrap(<div style={{maxWidth:440,margin:"80px auto 0",textAlign:"center",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 28px",boxShadow:SHADOW}}><div style={{fontSize:30,marginBottom:10}}>⚠️</div><div style={{fontSize:16,fontWeight:800,color:INK,marginBottom:6}}>Couldn't load this proposal</div><div style={{fontSize:13,color:WG,lineHeight:1.6}}>Please check the link, or get in touch with the studio.</div></div>);
  if(state==="notfound")return wrap(<div style={{maxWidth:440,margin:"80px auto 0",textAlign:"center",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 28px",boxShadow:SHADOW}}><div style={{fontSize:30,marginBottom:10}}>🔍</div><div style={{fontSize:16,fontWeight:800,color:INK,marginBottom:6}}>Proposal not found</div><div style={{fontSize:13,color:WG,lineHeight:1.6}}>This link may have expired or been withdrawn. Please contact the studio for an up-to-date quote.</div></div>);

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
  const depositOf=price=>price!=null?fmtR(price*(snap.depositPercent||50)/100):"—";

  return wrap(<div style={{maxWidth:680,margin:"0 auto"}}>
    {/* Header */}
    <div style={{background:INK,borderRadius:`${RADIUS}px ${RADIUS}px 0 0`,padding:"32px 32px 26px",color:WHITE}}>
      <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:12}}>Quote Proposal</div>
      {b.logo
        ?<div style={{background:WHITE,borderRadius:10,padding:"8px 14px",display:"inline-block"}}><img src={b.logo} alt={b.name||"Logo"} style={{maxWidth:200,maxHeight:54,objectFit:"contain",display:"block"}}/></div>
        :<div style={{fontSize:24,fontWeight:800}}>{b.name||"Our Studio"}</div>}
      <div style={{marginTop:12,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.7}}>
        {b.address&&<div>{b.address}</div>}
        {(b.phone||b.email)&&<div>{[b.phone,b.email].filter(Boolean).join("  ·  ")}</div>}
        {b.abn&&<div style={{color:"rgba(255,255,255,0.32)"}}>ABN {b.abn}</div>}
      </div>
    </div>

    <div style={{background:WHITE,borderRadius:`0 0 ${RADIUS}px ${RADIUS}px`,border:`1px solid ${BD}`,borderTop:"none",padding:"28px 32px 32px",boxShadow:SHADOW}}>
      <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:6}}>Prepared for</div>
      <div style={{fontSize:20,fontWeight:700,color:INK,marginBottom:4}}>{snap.clientName||"—"}</div>
      <div style={{fontSize:13,color:WG}}>{snap.jobType} · Valid until {fmtDate(snap.validUntil)}</div>
      {snap.intro&&<div style={{fontSize:14,color:"#444",lineHeight:1.7,marginTop:16,fontFamily:"Georgia,serif"}}>{snap.intro}</div>}

      {accepted&&<div style={{background:OK+"12",border:`1px solid ${OK}55`,borderRadius:10,padding:"16px 18px",margin:"20px 0 4px"}}>
        <div style={{fontSize:15,fontWeight:800,color:OK,marginBottom:3}}>✓ Thank you, {acceptedName||"and welcome"}!</div>
        <div style={{fontSize:13,color:INK,lineHeight:1.6}}>You've accepted <strong>{selectedOpts.length?selectedOpts.map(o=>o.label).join(" + "):"your option"}</strong>{comboPrice>0?` at ${fmtR(comboPrice)} (inc GST)`:""}. The studio has been notified and will be in touch about your deposit and next steps.</div>
      </div>}

      {/* Options */}
      <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",margin:"24px 0 6px"}}>{accepted?"Your selection":multi?"Choose the pieces you'd like":opts.length>1?"Choose an option":"Your quote"}</div>
      {!accepted&&multi&&<div style={{fontSize:12,color:WG,marginBottom:12}}>Tick every piece you'd like — you can choose more than one.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {opts.map(o=>{
          const isSel=selectedIds.includes(o.id);
          const dim=accepted&&!isSel;
          return <div key={o.id} onClick={()=>toggle(o.id)}
            style={{border:`2px solid ${isSel?GOLD:BD}`,borderRadius:12,padding:"16px 18px",cursor:accepted?"default":"pointer",background:isSel?GOLD_L+"44":WHITE,opacity:dim?0.5:1,transition:"all 0.15s",position:"relative"}}>
            {o.recommended&&<div style={{position:"absolute",top:-9,left:16,background:GOLD,color:WHITE,fontSize:9,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"2px 10px",borderRadius:20}}>Recommended</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {!accepted&&<div style={{width:18,height:18,borderRadius:multi?4:"50%",border:`2px solid ${isSel?GOLD:BD}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{isSel&&(multi?<span style={{color:GOLD,fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>:<div style={{width:9,height:9,borderRadius:"50%",background:GOLD}}/>)}</div>}
                  <div style={{fontSize:16,fontWeight:700,color:INK}}>{o.label}</div>
                </div>
                {o.description&&<div style={{fontSize:13,color:WG,lineHeight:1.6,marginTop:6,fontFamily:"Georgia,serif"}}>{o.description}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:22,fontWeight:800,color:INK}}>{o.price!=null?fmtR(o.price):"—"}</div>
                <div style={{fontSize:10,color:WG}}>inc GST</div>
              </div>
            </div>
          </div>;
        })}
      </div>

      {/* Combined total (multi-select) */}
      {multi&&selectedOpts.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:14,padding:"12px 16px",background:INK,borderRadius:10}}>
        <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Combined total · {selectedOpts.length} piece{selectedOpts.length!==1?"s":""}</span>
        <span style={{fontSize:20,fontWeight:800,color:WHITE}}>{fmtR(comboPrice)} <span style={{fontSize:11,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>inc GST</span></span>
      </div>}

      {/* Payments received → balance due, else deposit note (on the combined total) */}
      {selectedOpts.length>0&&comboPrice>0&&(()=>{
        const paid=Number(snap.paidTotal)||0;
        if(paid<=0.005)return <div style={{fontSize:12,color:WG,marginTop:14}}>To proceed, a {snap.depositPercent||50}% deposit of <strong style={{color:INK}}>{depositOf(comboPrice)}</strong> is required.</div>;
        const due=Math.max(0,comboPrice-paid);
        return <div style={{marginTop:16,background:PARCH,border:`1px solid ${BD}`,borderRadius:10,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"2px 0"}}><span>{multi?"Combined total":"Total price"} (inc GST)</span><span style={{color:INK,fontWeight:600}}>{fmtR(comboPrice)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:WG,padding:"2px 0"}}><span>Payments received</span><span style={{color:OK,fontWeight:600}}>− {fmtR(paid)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderTop:`1px solid ${BD}`,marginTop:8,paddingTop:10}}><span style={{fontSize:13,fontWeight:700,color:INK}}>{due<=0.005?"Paid in full":"Balance now due"}</span><span style={{fontSize:18,fontWeight:800,color:due<=0.005?OK:INK}}>{fmtR(due)}</span></div>
        </div>;
      })()}

      {/* Accept box */}
      {!accepted&&<div style={{borderTop:`1px solid ${BD}`,marginTop:22,paddingTop:20}}>
        <div style={{fontSize:13,fontWeight:700,color:INK,marginBottom:10}}>Accept {multi?"your selection":"this proposal"}</div>
        {multi&&!picks.length&&<div style={{fontSize:12,color:WARN,marginBottom:10}}>Tick at least one piece above to continue.</div>}
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Type your full name to confirm" style={{...SS.inp,marginTop:0,marginBottom:12}}/>
        <button onClick={accept} disabled={!picks.length||!name.trim()||busy}
          style={{width:"100%",background:(!picks.length||!name.trim()||busy)?BD:INK,color:WHITE,border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:800,cursor:(!picks.length||!name.trim()||busy)?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>
          {busy?"Submitting…":multi?`Accept ${picks.length} piece${picks.length!==1?"s":""}${comboPrice>0?` — ${fmtR(comboPrice)}`:""}`:`Accept${selectedOpts[0]?` — ${selectedOpts[0].label}`:""}`}
        </button>
        <div style={{fontSize:11,color:WG,marginTop:10,lineHeight:1.5}}>By accepting you agree to the terms below. This records your selection and notifies the studio — it is not a payment.</div>
      </div>}

      {/* Terms */}
      {snap.terms&&<div style={{borderTop:`1px solid ${BD}`,marginTop:22,paddingTop:18}}>
        <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:10}}>Terms &amp; conditions</div>
        <div style={{fontSize:11,color:WG,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{snap.terms}</div>
      </div>}
      <div style={{textAlign:"center",fontSize:10,color:WG,marginTop:24}}>All prices inclusive of GST · Quoted in AUD</div>
    </div>
  </div>);
}

// ── Quote Proposal Preview ────────────────────────────────────────────────
function ProposalPreview({quote,job,clients=[],biz,calc,payments=[],onClose}){
  const client=clients.find(x=>x.id===job?.clientId)||null;
  const quoteNum="QT-"+quote.id.slice(-6).toUpperCase();
  const issuedDate=new Date(quote.createdAt).toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"});
  const validDays=biz.quoteValidityDays||30;
  const validUntil=new Date(new Date(quote.createdAt).getTime()+validDays*86400000).toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"});
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
  // Payments already recorded against this job → outstanding balance the proposal should request.
  const paidTotal=(payments||[]).filter(p=>p.jobId===job?.id&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const hasPaid=paidTotal>0.005;
  const outstanding=Math.max(0,grandProposalTotal-paidTotal);
  const paidInFull=hasPaid&&outstanding<=0.005;
  // Client-facing description — manual field takes priority over job description
  const description=quote.clientDescription||job?.description||"";

  const copyEmailText=()=>{
    const text=[
      `Dear ${client?.name||""},`,
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
      `Total price: ${priceDisplay} (inc. GST)`,
      ...(hasPaid?[
        `Payments received: -${fmtR(paidTotal)}`,
        paidInFull?`Balance now due: ${fmtR(0)} — paid in full. Thank you.`:`Balance now due: ${fmtR(outstanding)}`,
      ]:[`Quote valid until: ${validUntil}`]),
      ``,
      ...(hasPaid?(paidInFull?[]:[`To proceed, please settle the outstanding balance of ${fmtR(outstanding)}.`]):[`To proceed, a ${deposit}% deposit of ${depositAmt||"—"} is required.`]),
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
  const clientName=client?.name||"";

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
        <span style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.85)",letterSpacing:"0.05em"}}>Proposal · {quoteNum}</span>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={copyEmailText} style={{background:copied?"#2D7A4F22":"rgba(255,255,255,0.06)",border:`1px solid ${copied?"#2D7A4F":"rgba(255,255,255,0.15)"}`,borderRadius:8,padding:"6px 16px",color:copied?"#4CAF84":"rgba(255,255,255,0.7)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
          {copied?"✓ Copied":"✉ Copy email text"}
        </button>
        <button onClick={()=>window.print()} style={{background:WHITE,border:"none",borderRadius:8,padding:"6px 18px",color:INK,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>
          Print / Save PDF
        </button>
      </div>
    </div>

    {/* ── Scroll area ── */}
    <div id="proposal-scroll" style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"40px 20px 60px",background:"#111"}}>
      <div id="proposal-document" style={{width:"100%",maxWidth:740,margin:"0 auto",background:WHITE,borderRadius:4,boxShadow:"0 20px 80px rgba(0,0,0,0.6)",fontFamily:"Georgia,serif",color:INK}}>

        {/* ── HEADER ── */}
        <div style={{background:INK,padding:"40px 52px 36px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontFamily:"'DM Sans',sans-serif"}}>Quote Proposal</div>
            {biz.logo
              ?<div style={{background:WHITE,borderRadius:10,padding:"8px 14px",display:"inline-block"}}><img src={biz.logo} alt={biz.name||"Logo"} style={{maxWidth:220,maxHeight:60,objectFit:"contain",display:"block"}}/></div>
              :<div style={{fontSize:26,fontWeight:800,color:WHITE,letterSpacing:"-0.01em",fontFamily:"'DM Sans',sans-serif",lineHeight:1.1}}>{biz.name||"Your Studio"}</div>}
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:3}}>
              {biz.address&&<div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'DM Sans',sans-serif"}}>{biz.address}</div>}
              {(biz.phone||biz.email)&&<div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'DM Sans',sans-serif"}}>{[biz.phone,biz.email].filter(Boolean).join("  ·  ")}</div>}
              {biz.abn&&<div style={{fontSize:10,color:"rgba(255,255,255,0.28)",fontFamily:"'DM Sans',sans-serif",marginTop:2}}>ABN {biz.abn}</div>}
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:20,fontWeight:800,color:WHITE,letterSpacing:"0.06em",fontFamily:"'DM Sans',sans-serif"}}>{quoteNum}</div>
            <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'DM Sans',sans-serif"}}>Issued: <span style={{color:"rgba(255,255,255,0.7)"}}>{issuedDate}</span></div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'DM Sans',sans-serif"}}>Valid until: <span style={{color:"rgba(255,255,255,0.85)"}}>{validUntil}</span></div>
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{height:1,background:BD}}/>

        {/* ── PREPARED FOR + JOB DESCRIPTION ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,borderBottom:`1px solid ${BD}`}}>
          <div style={{padding:"28px 32px 28px 52px",borderRight:`1px solid ${BD}`}}>
            <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}>Prepared for</div>
            <div style={{fontSize:20,fontWeight:700,color:INK,fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>{clientName||"—"}</div>
            {client?.email&&<div style={{fontSize:12,color:WG,fontFamily:"'DM Sans',sans-serif",marginTop:3}}>{client.email}</div>}
            {client?.phone&&<div style={{fontSize:12,color:WG,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{client.phone}</div>}
          </div>
          <div style={{padding:"28px 52px 28px 32px"}}>
            <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}>Piece</div>
            <div style={{fontSize:15,fontWeight:700,color:INK,fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>{job?.type||"Custom Jewellery"}</div>
            {description
              ?<div style={{fontSize:13,color:"#444",lineHeight:1.75,fontFamily:"Georgia,serif"}}>{description}</div>
              :<div style={{fontSize:12,color:WG,fontStyle:"italic",fontFamily:"'DM Sans',sans-serif"}}>No description added — edit quote to add one.</div>
            }
            {(job?.dateIn||job?.dateOut)&&<div style={{marginTop:16,display:"flex",gap:28}}>
              <div><div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>Taken in</div><div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'DM Sans',sans-serif"}}>{job?.dateIn?fmtDate(job.dateIn):"—"}</div></div>
              <div><div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>Pickup / collection</div><div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'DM Sans',sans-serif"}}>{job?.dateOut?fmtDate(job.dateOut):"—"}</div></div>
            </div>}
          </div>
        </div>

        {/* ── RENDER / IMAGE ── (only shown when the job has photos) */}
        {imgUrls.length>0&&<div style={{padding:"28px 52px",borderBottom:`1px solid ${BD}`}}>
          <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:14,fontFamily:"'DM Sans',sans-serif"}}>Design &amp; reference</div>
          <div style={{display:"grid",gridTemplateColumns:imgUrls.length===1?"1fr":"1fr 1fr",gap:12}}>
            {imgUrls.map((im,i)=>(
              <div key={i} style={{gridColumn:imgUrls.length===3&&i===0?"1 / -1":"auto"}}>
                <img src={im.url} alt={im.caption||"Reference"} style={{width:"100%",height:imgUrls.length===1?320:220,objectFit:"cover",borderRadius:6,border:`1px solid ${BD}`,display:"block"}}/>
                {im.caption&&<div style={{fontSize:11,color:WG,marginTop:6,fontStyle:"italic",fontFamily:"Georgia,serif"}}>{im.caption}</div>}
              </div>
            ))}
          </div>
        </div>}

        {/* ── PRICE BREAKDOWN ── */}
        <div style={{padding:"28px 52px",borderBottom:`1px solid ${BD}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
            <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",fontFamily:"'DM Sans',sans-serif"}}>Price breakdown</div>
            <div style={{fontSize:10,color:WG,fontFamily:"'DM Sans',sans-serif"}}>All prices inclusive of GST</div>
          </div>

          {/* Jewellery row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:24,padding:"13px 0",borderTop:`1px solid ${BD}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'DM Sans',sans-serif"}}>{job?.type||"Jewellery piece"}</div>
              <div style={{fontSize:11,color:WG,marginTop:3,lineHeight:1.6,fontFamily:"Georgia,serif"}}>{description||"Design, materials & craftsmanship"}</div>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:INK,fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"}}>{manual?<span style={{fontSize:12,fontWeight:400,fontStyle:"italic",color:WG}}>Included</span>:calc.bracket?fmtR(settingTotal):"—"}</div>
          </div>

          {/* Stone row — studio sourcing */}
          {quote.stoneMode==="sourcing"&&stoneTotal>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderTop:`1px solid ${BD}`}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'DM Sans',sans-serif"}}>Centre / feature stone</div>
              <div style={{fontSize:11,color:WG,marginTop:2,fontFamily:"'DM Sans',sans-serif"}}>{quote.stoneType==="lab"?"Lab-grown diamond / gemstone":"Natural diamond / gemstone"} · inc. GST</div>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:INK,fontFamily:"'DM Sans',sans-serif"}}>{manual?<span style={{fontSize:12,fontWeight:400,fontStyle:"italic",color:WG}}>Included</span>:fmtR(stoneTotal)}</div>
          </div>}

          {/* Client stone row */}
          {quote.stoneMode==="client"&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderTop:`1px solid ${BD}`}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:INK,fontFamily:"'DM Sans',sans-serif"}}>Centre / feature stone</div>
              <div style={{fontSize:11,color:WG,marginTop:2,fontFamily:"'DM Sans',sans-serif"}}>Supplied by client — not included in this quote</div>
            </div>
            <div style={{fontSize:12,color:WG,fontStyle:"italic",fontFamily:"'DM Sans',sans-serif"}}>Client supplied</div>
          </div>}

          {/* Total row — when payments are recorded, show total, payments received and balance due */}
          {!markupUndef&&hasPaid
            ?<div style={{marginTop:12,background:INK,borderRadius:4,padding:"18px 22px",fontFamily:"'DM Sans',sans-serif"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"rgba(255,255,255,0.65)",padding:"3px 0"}}>
                <span>Total price (inc. GST)</span><span style={{color:WHITE,fontWeight:600}}>{priceDisplay}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"rgba(255,255,255,0.65)",padding:"3px 0"}}>
                <span>Payments received</span><span style={{color:"#7FD7A6",fontWeight:600}}>− {fmtR(paidTotal)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderTop:"1px solid rgba(255,255,255,0.18)",marginTop:10,paddingTop:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>{paidInFull?"Paid in full":"Balance now due"}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Inc. GST · AUD</div>
                </div>
                <div style={{fontSize:30,fontWeight:800,color:paidInFull?"#7FD7A6":WHITE,letterSpacing:"-0.02em"}}>{fmtR(outstanding)}</div>
              </div>
            </div>
            :<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",marginTop:12,background:INK,borderRadius:4}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'DM Sans',sans-serif",marginBottom:2}}>Total quoted price</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'DM Sans',sans-serif"}}>Inc. GST · Quoted in AUD</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:30,fontWeight:800,color:WHITE,letterSpacing:"-0.02em",fontFamily:"'DM Sans',sans-serif"}}>{priceDisplay}</div>
                {depositAmt&&<div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>
                  {deposit}% deposit to commence: <span style={{color:WHITE,fontWeight:700}}>{depositAmt}</span>
                </div>}
              </div>
            </div>}
        </div>

        {/* ── TERMS ── */}
        <div style={{padding:"28px 52px",borderBottom:`1px solid ${BD}`}}>
          <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:14,fontFamily:"'DM Sans',sans-serif"}}>Terms &amp; conditions</div>
          <div style={{fontSize:11,color:"#555",lineHeight:1.85,fontFamily:"Georgia,serif"}}>{terms}</div>
        </div>

        {/* ── CLIENT ACCEPTANCE ── */}
        <div style={{padding:"28px 52px 44px"}}>
          <div style={{fontSize:9,fontWeight:700,color:WG,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:14,fontFamily:"'DM Sans',sans-serif"}}>Client acceptance</div>
          <div style={{fontSize:12,color:"#555",marginBottom:28,fontFamily:"Georgia,serif",lineHeight:1.75}}>
            I, the undersigned, accept the above quote and authorise work to commence upon payment of the required deposit.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px 40px"}}>
            {[["Signature",""],["Print name",""],["Date",""],["Deposit paid","$"]].map(([label,prefix])=>(
              <div key={label}>
                <div style={{borderBottom:`1px solid #CCC`,paddingBottom:6,minHeight:36,display:"flex",alignItems:"flex-end",fontSize:13,color:WG,fontFamily:"'DM Sans',sans-serif"}}>{prefix}</div>
                <div style={{fontSize:10,color:WG,marginTop:6,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.05em"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{borderTop:`1px solid ${BD}`,padding:"14px 52px",display:"flex",justifyContent:"space-between",alignItems:"center",background:PARCH}}>
          <div style={{fontSize:10,color:WG,fontFamily:"'DM Sans',sans-serif"}}>{biz.name||""}{biz.name?" · ":""}{quoteNum}</div>
          <div style={{fontSize:10,color:WG,fontFamily:"'DM Sans',sans-serif"}}>Valid until {validUntil}</div>
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
function QuoteDetail({quoteId,quotes,setQuotes,jobs,clients,biz,markupTable,naturalStoneMarkup,labStoneMarkup,payments=[],setView}){
  const q=quotes.find(x=>x.id===quoteId);
  if(!q)return null;
  const job=jobs.find(j=>j.id===q.jobId);
  const c=job?clients.find(x=>x.id===job.clientId):null;
  const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
  const activeStoneMarkup=q.stoneType==="lab"?(labStoneMarkup||[]):(naturalStoneMarkup||[]);
  const stoneCalc=q.stoneMode==="sourcing"&&q.stoneItems?.length?calcStoneQuote(q.stoneItems,activeStoneMarkup):null;
  const stoneClientTotal=stoneCalc?.clientTotal||0;
  const accentStoneTotal=q.accentStoneTotal||0;
  const manual=quoteIsManual(q);
  const grandTotal=manual?Number(q.manualTotal):calc.finalLow+stoneClientTotal+accentStoneTotal;
  // "—" only when there ARE jewellery costs but no markup tier matches; a stones-only
  // quote (no line items → base 0) is a valid total, not an undefined one.
  const markupUndef=!manual&&calc.base>0&&!calc.bracket&&!calc.overridden;
  const grandStr=markupUndef?"—":fmtR(grandTotal);
  const setStatus=s=>setQuotes(p=>{
    // Only one approved quote per job: demote any other currently-approved quote on this job
    const n=p.map(x=>{
      if(x.id===quoteId)return{...x,status:s};
      if(s==="Approved"&&x.jobId===q.jobId&&x.status==="Approved")return{...x,status:"Declined"};
      return x;
    });
    persist(K.qu,n);return n;
  });
  const delQuote=()=>{
    if(!confirm("Delete this quote? This cannot be undone."))return;
    setQuotes(p=>{const n=p.filter(x=>x.id!==quoteId);persist(K.qu,n);return n;});
    setView("jobDetail_"+q.jobId);
  };
  const[showProposal,setShowProposal]=useState(false);

  return <div>
    {showProposal&&<ProposalPreview quote={q} job={job} clients={clients} biz={biz} calc={calc} payments={payments} onClose={()=>setShowProposal(false)}/>}
    <button onClick={()=>setView("jobDetail_"+q.jobId)} style={{background:"none",border:"none",cursor:"pointer",color:GOLD,fontSize:13,fontWeight:700,fontFamily:"inherit",marginBottom:18,padding:0}}>← Back to job</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
      <div><h1 style={{margin:0,fontSize:24,fontWeight:800,color:INK,letterSpacing:"-0.02em"}}>{quoteLabel(q)}</h1>
      <div style={{color:WG,fontSize:13,marginTop:3}}>Quote {quoteRef(q)} · {job?.type} · {c?.name} · {fmtDate(q.createdAt)}</div>
      {(job?.dateIn||job?.dateOut)&&<div style={{color:WG,fontSize:12,marginTop:2}}>Taken in: <b style={{color:INK}}>{job?.dateIn?fmtDate(job.dateIn):"—"}</b> · Pickup: <b style={{color:INK}}>{job?.dateOut?fmtDate(job.dateOut):"—"}</b></div>}</div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <Badge label={q.status} color={q.status==="Approved"?OK:q.status==="Draft"?WG:GOLD_D}/>
        <Btn sm ghost onClick={()=>setView("editQuote_"+q.id)}>✏ Edit quote</Btn>
        <Btn sm danger onClick={delQuote}>Delete</Btn>
        <Btn sm onClick={()=>setShowProposal(true)}>📄 Preview &amp; Print proposal</Btn>
      </div>
    </div>

    <Card>
      {/* Cost breakdown table */}
      <div style={{fontWeight:700,fontSize:14,color:INK,marginBottom:12}}>Cost breakdown</div>
      <div style={{display:"grid",gridTemplateColumns:"180px 1fr 130px",gap:6,marginBottom:8}}>
        {["Item","Detail","Cost"].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
      </div>
      {q.lineItems.length===0&&<div style={{fontSize:13,color:WG,fontStyle:"italic",padding:"10px 0"}}>No itemised costs — this quote uses a manual quoted price.</div>}
      {q.lineItems.map(li=>{
        const cost=lineCost(li);
        const stoneMU=li.markupMode==="natural"||li.markupMode==="lab";
        return <div key={li.id} style={{display:"grid",gridTemplateColumns:"180px 1fr 44px 110px",gap:6,padding:"9px 0",borderBottom:`1px solid ${BD}`,fontSize:13,alignItems:"center"}}>
          <span style={{fontWeight:600,color:INK}}>{li.description}</span>
          <span style={{color:WG,fontSize:12}}>{li.detail}</span>
          <span>{stoneMU?<span style={{background:"#C4A8F0",color:"#3A2A6A",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:2,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>STONE MU</span>:li.noMarkup&&<span style={{background:"#7B5EA7",color:WHITE,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:2,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>NO MU</span>}</span>
          <span style={{fontWeight:700,color:stoneMU?"#7B5EA7":li.noMarkup?"#7B5EA7":INK,textAlign:"right"}}>{fmt(cost)}</span>
        </div>;
      })}

      {/* Markup summary — hidden for a pure manual-price quote (nothing to mark up) */}
      {q.lineItems.length>0&&<div style={{marginTop:20,marginBottom:q.stoneMode&&q.stoneMode!=="none"?24:0}}>
        <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Jewellery costs</div>
        <MarkupSummary {...calc} large/>
      </div>}

      {/* Client supplying stone note */}
      {q.stoneMode==="client"&&<div style={{background:"#EEF4FB",border:"1px solid #B8D4EC",borderRadius:4,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:"#2C5282",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Centre / Feature Stone</div>
        <div style={{fontSize:13,color:"#2C5282"}}>Client supplying their own stone — no stone cost on this quote.</div>
        {q.stoneNotes&&<div style={{fontSize:12,color:"#4A7FA5",marginTop:6,fontStyle:"italic"}}>{q.stoneNotes}</div>}
      </div>}

      {/* Studio sourcing stone */}
      {q.stoneMode==="sourcing"&&q.stoneItems?.length>0&&<div style={{borderTop:`2px dashed ${BD}`,paddingTop:20,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{background:q.stoneType==="lab"?"#7B5EA7":"#3B6E8F",color:WHITE,borderRadius:2,padding:"2px 10px",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>{q.stoneType==="lab"?"Lab-Grown Diamond / Gemstone":"Natural Diamond / Gemstone"}</div>
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
          <div style={{fontSize:11,fontWeight:700,color:q.stoneType==="lab"?"#7B5EA7":"#3B6E8F",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Stone pricing — markup + GST</div>
          <StoneMarkupSummary calc={stoneCalc}/>
        </div>
        {q.stoneNotes&&<div style={{marginTop:10,fontSize:12,color:WG,fontStyle:"italic"}}>{q.stoneNotes}</div>}
      </div>}

      {/* Grand total bar — shown when there's a centre stone, accent stones on stone markup, or a manual price */}
      {(stoneCalc||accentStoneTotal>0||manual)&&(()=>{
        const cells=[
          ...(manual&&!q.lineItems.length?[]:[["Jewellery piece",(manual&&calc.base>0&&!calc.bracket&&!calc.overridden)?"—":fmtR(calc.finalLow),GOLD]]),
          ...(accentStoneTotal>0?[["Accent stones",fmtR(accentStoneTotal),"#C4A8F0"]]:[]),
          ...(stoneCalc?[["Stone",fmtR(stoneCalc.clientTotal),q.stoneType==="lab"?"#C4A8F0":"#8EB5D4"]]:[]),
          [manual?"Quoted price — manual":"Combined total",grandStr,OK],
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
    const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
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
    <SectionHeader title="Quotes" action={<Btn onClick={()=>{setSelClient("");setSelJob("");setModal(true);}}>+ New Quote</Btn>}/>
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
            style={{display:"flex",alignItems:"center",gap:7,padding:"6px 13px",borderRadius:20,border:`1px solid ${active?INK:BD}`,background:active?INK:"transparent",color:active?WHITE:WG,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {t}<span style={{fontSize:11,fontWeight:700,color:active?"rgba(255,255,255,0.6)":WG}}>{n}</span>
          </button>;
        })}
      </div>

      {/* ── Search ── */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by client, job type or quote title…" style={{...SS.inp,marginTop:0,marginBottom:16}}/>

      {shown.length===0&&<Card><div style={{color:WG,fontSize:14,textAlign:"center",padding:"18px 0"}}>No quotes match.</div></Card>}
    </>}

    {shown.map(({q,job,cl,price,priceKnown,expired,daysSent,followUp,expiryISO})=>{
      const manual=quoteIsManual(q);
      const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
      const priceStr=priceKnown?fmtR(price):"—";
      return <Card key={q.id} onClick={()=>setView("quoteDetail_"+q.id)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:INK}}>{quoteLabel(q)} {q.title?.trim()&&<span style={{fontWeight:400,color:WG,fontSize:12}}>· {quoteRef(q)}</span>}</div>
            <div style={{fontSize:13,color:WG,marginTop:3}}>{job?.type} · {cl?.name} · {fmtDate(q.createdAt)}</div>
            <div style={{display:"flex",gap:10,fontSize:12,color:WG,marginTop:2,flexWrap:"wrap"}}>
              {manual?<span style={{color:GOLD_D,fontWeight:700}}>Manual quoted price</span>:<span>Setting: {calc.mult||"—"}× markup</span>}
              {q.stoneMode==="sourcing"&&<span style={{color:"#7B5EA7"}}>+ {q.stoneType==="lab"?"Lab-Grown":"Natural"} stone (separate markup)</span>}
              {q.stoneMode==="client"&&<span style={{color:"#7B5EA7"}}>+ Client supplying stone</span>}
            </div>
            {/* Follow-up + expiry flags */}
            {(followUp||expired)&&<div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
              {followUp&&<span style={{background:GOLD_L,color:GOLD_D,border:`1px solid ${GOLD}55`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>🔔 Sent {daysSent} days ago — follow up?</span>}
              {expired&&<span style={{background:DANGER+"14",color:DANGER,border:`1px solid ${DANGER}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>⚠ Expired {fmtDate(expiryISO)}</span>}
            </div>}
          </div>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <Badge label={q.status} color={q.status==="Approved"?OK:q.status==="Draft"?WG:q.status==="Declined"?DANGER:GOLD_D}/>
            <div style={{fontWeight:800,fontSize:17,color:OK,textAlign:"right"}}>{priceStr}</div>
          </div>
        </div>
      </Card>;
    })}
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
const nextInvoiceNumber=(invoices)=>{
  const nums=invoices.map(i=>parseInt(i.number)||0).filter(n=>n>0);
  const max=nums.length?Math.max(...nums):1000;
  return String(max+1).padStart(8,'0');
};

// ── Invoice print view ───────────────────────────────────────────────────
function InvoicePrintView({inv,job,client,biz,payments,onClose}){
  const paidTotal=(payments||[]).filter(p=>p.jobId===inv.jobId&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const balance=Math.max(0,inv.totalIncGST-paidTotal);
  const requestAmount=Number(inv.requestAmount)||0;
  const staged=requestAmount>0;
  const dueNow=staged?Math.min(requestAmount,balance):balance;
  const remainingAfter=Math.max(0,balance-dueNow);
  const[copied,setCopied]=useState(false);
  const copyBank=()=>{
    const txt=[`Bank: ${biz.bankName||""}`,`Account name: ${biz.bankAccountName||biz.name||""}`,`BSB: ${biz.bankBSB||""}`,`Account: ${biz.bankAccount||""}`,`Reference: ${inv.number}`].join("\n");
    navigator.clipboard?.writeText(txt).catch(()=>{});
    setCopied(true);setTimeout(()=>setCopied(false),2000);
  };
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:500,display:"flex",flexDirection:"column",backdropFilter:"blur(4px)"}}>
    {/* toolbar */}
    <div style={{background:"#000",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <button onClick={onClose} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",borderRadius:2,padding:"6px 14px",color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase"}}>← Back</button>
        <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.85)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Tax Invoice — {inv.number}</div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={copyBank} style={{background:copied?"#2D7A4F":"rgba(255,255,255,0.08)",border:`1px solid ${copied?"#2D7A4F":"rgba(255,255,255,0.2)"}`,borderRadius:8,padding:"7px 16px",color:copied?WHITE:"rgba(255,255,255,0.8)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em",textTransform:"uppercase",transition:"all 0.2s"}}>{copied?"✓ Copied":"Copy bank details"}</button>
        <button onClick={()=>window.print()} style={{background:WHITE,border:"none",borderRadius:8,padding:"7px 20px",color:INK,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em",textTransform:"uppercase"}}>Print / Save PDF</button>
      </div>
    </div>
    {/* page */}
    <div id="invoice-scroll" style={{flex:1,overflow:"auto",padding:"32px 24px",display:"flex",justifyContent:"center",alignItems:"flex-start"}}>
      <div id="invoice-document" style={{width:"100%",maxWidth:700,minHeight:990,background:WHITE,fontFamily:"'DM Sans',sans-serif",boxShadow:"0 8px 48px rgba(0,0,0,0.5)",display:"flex",flexDirection:"column"}}>
        {/* header */}
        <div style={{padding:"52px 56px 40px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            {biz.logo
              ?<img src={biz.logo} alt={biz.name||"Logo"} style={{maxWidth:240,maxHeight:80,objectFit:"contain",display:"block"}}/>
              :<div style={{background:INK,padding:"12px 20px 8px",display:"inline-block",borderRadius:4}}>
                  <div style={{fontSize:30,fontWeight:900,color:WHITE,letterSpacing:"0.12em",lineHeight:1}}>{biz.name||"VAHÉ"}</div>
                  <div style={{fontSize:8,fontWeight:400,color:"rgba(255,255,255,0.8)",letterSpacing:"0.3em",textAlign:"center",marginTop:3}}>JEWELLERY</div>
                </div>}
            {biz.abn&&<div style={{fontSize:10,color:WG,letterSpacing:"0.04em",marginTop:12}}>ABN {biz.abn}</div>}
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
          <div style={{fontSize:17,color:INK,fontWeight:700}}>{client?.name||"—"}</div>
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
                <th style={{padding:"0 0 12px",textAlign:"right",fontWeight:700,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:WG,width:"24%"}}>Amount (inc&nbsp;GST)</th>
              </tr>
            </thead>
            <tbody>
              {inv.descriptionOverride?.trim()
                ?<tr style={{borderBottom:`1px solid ${BD_SOFT}`}}>
                    <td style={{padding:"18px 0",color:INK,lineHeight:1.65,whiteSpace:"pre-wrap",fontWeight:500}}>{inv.descriptionOverride}</td>
                    <td style={{padding:"18px 0",textAlign:"center",color:WG,fontSize:12}}>GST</td>
                    <td style={{padding:"18px 0",textAlign:"right",fontWeight:700,color:INK}}>{fmt(inv.totalIncGST)}</td>
                  </tr>
                :inv.lineItems.map(li=>(
                  <tr key={li.id} style={{borderBottom:`1px solid ${BD_SOFT}`}}>
                    <td style={{padding:"15px 0",color:INK,lineHeight:1.5}}>
                      <div style={{fontWeight:600}}>{li.description}</div>
                      {li.detail&&<div style={{fontSize:11,color:WG,marginTop:3}}>{li.detail}</div>}
                    </td>
                    <td style={{padding:"15px 0",textAlign:"center",color:WG,fontSize:12}}>GST</td>
                    <td style={{padding:"15px 0",textAlign:"right",fontWeight:600,color:INK}}>{fmt(lineCostLow(li))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* totals */}
        <div style={{padding:"28px 56px 40px",display:"flex",justifyContent:"flex-end"}}>
          <div style={{minWidth:300}}>
            {[["Total (incl. GST)",fmt(inv.totalIncGST)],["Includes GST",fmt(inv.gst)],["Paid to date",fmt(paidTotal)],...(staged?[["Balance outstanding",fmt(balance)]]:[])].map(([l,v])=>(
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
        @page { margin: 12mm; }
        html, body { background: #fff !important; }
        body * { visibility: hidden !important; }
        #invoice-document, #invoice-document * { visibility: visible !important; }
        #invoice-scroll { position: static !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
        #invoice-document {
          position: absolute !important; left: 0 !important; top: 0 !important;
          width: 100% !important; max-width: 100% !important; box-shadow: none !important; margin: 0 !important;
        }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>
  </div>;
}

// ── Invoice detail ────────────────────────────────────────────────────────
function InvoiceDetail({invoiceId,invoices,setInvoices,jobs,clients,payments,biz,setView}){
  const inv=invoices.find(x=>x.id===invoiceId);
  if(!inv)return null;
  const job=jobs.find(j=>j.id===inv.jobId);
  const c=job?clients.find(x=>x.id===job.clientId):null;
  const[showPrint,setShowPrint]=useState(false);
  const setStatus=s=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,status:s}:x);persist(K.inv,n);return n;});
  const del=()=>{
    if(!confirm(`Delete invoice ${inv.number}? This can't be undone. Payments recorded against the job are not affected, and the quote stays so you can re-invoice it.`))return;
    setInvoices(p=>{const n=p.filter(x=>x.id!==invoiceId);persist(K.inv,n);return n;});
    setView("invoices");
  };
  const setDescOverride=v=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,descriptionOverride:v}:x);persist(K.inv,n);return n;});
  const setRequestAmount=v=>setInvoices(p=>{const n=p.map(x=>x.id===invoiceId?{...x,requestAmount:v}:x);persist(K.inv,n);return n;});
  const paidTotal=(payments||[]).filter(p=>p.jobId===inv.jobId&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  const balance=Math.max(0,inv.totalIncGST-paidTotal);
  // Staged request: optionally request only a specific amount now (e.g. the diamond balance),
  // with the rest noted as payable later. Blank = request the full outstanding balance.
  const requestAmount=Number(inv.requestAmount)||0;
  const staged=requestAmount>0;
  const dueNow=staged?Math.min(requestAmount,balance):balance;
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
    const{error}=await supabase.from(PUBLIC_PROPOSALS_TABLE).upsert({token,data:snapshot,status:"sent",created_at:new Date().toISOString()},{onConflict:"token"});
    setLinkBusy(false);
    if(error){alert("Couldn't create the link: "+error.message+"\n\nIf it mentions a missing table, the proposals Supabase setup (supabase-public-proposals.sql) hasn't been run.");return;}
    navigator.clipboard?.writeText(`${window.location.origin}/?p=${token}`).catch(()=>{});
    setLinkCopied(true);setTimeout(()=>setLinkCopied(false),2200);
  };
  return <div>
    {showPrint&&<InvoicePrintView inv={inv} job={job} client={c} biz={biz} payments={payments} onClose={()=>setShowPrint(false)}/>}
    <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center"}}>
      <button onClick={()=>setView("invoices")} style={{background:"none",border:"none",cursor:"pointer",color:GOLD,fontSize:13,fontWeight:700,fontFamily:"inherit",padding:0}}>← Invoices</button>
      {job&&<><span style={{color:BD}}>·</span><button onClick={()=>setView("jobDetail_"+inv.jobId)} style={{background:"none",border:"none",cursor:"pointer",color:WG,fontSize:13,fontFamily:"inherit",padding:0}}>View job</button></>}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
      <div>
        <h1 style={{margin:0,fontSize:24,fontWeight:700,color:INK}}>{inv.number}</h1>
        <div style={{color:WG,fontSize:13,marginTop:3}}>{job?.type} · {c?.name} · {fmtDate(inv.date)}</div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <Badge label={inv.status} color={inv.status==="Paid"?OK:inv.status==="Overdue"?DANGER:WARN} size="lg"/>
        <Btn sm onClick={shareInvoice}>{linkBusy?"Creating…":linkCopied?"✓ Link copied":inv.publicToken?"🔗 Copy link":"🔗 Create link"}</Btn>
        {inv.publicToken&&<Btn sm ghost onClick={()=>window.open(invLink,"_blank")}>Preview</Btn>}
        <Btn sm onClick={()=>setShowPrint(true)}>🖨 Preview &amp; Print</Btn>
        <Btn sm danger onClick={del}>Delete</Btn>
      </div>
    </div>
    {inv.publicToken&&<div style={{background:GOLD_L+"55",border:`1px solid ${GOLD}55`,borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:12,fontWeight:700,color:GOLD_D,whiteSpace:"nowrap"}}>🔗 Client link</span>
      <span style={{flex:1,minWidth:200,fontSize:12,color:WG,wordBreak:"break-all",fontFamily:"monospace"}}>{invLink}</span>
      <span style={{fontSize:11,color:WG}}>Re-copy to refresh totals before sending.</span>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:staged?10:18}}>
      {[["Invoice total",fmt(inv.totalIncGST),INK],["Total paid",fmt(paidTotal),OK],[staged?"Due now":"Balance due",fmt(dueNow),dueNow>0.5?WARN:OK]].map(([l,v,col])=>(
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
      <div style={{fontSize:11,color:GOLD_D,marginTop:8}}>After changing this, click <strong>🔗 Copy link</strong> above to refresh what the client sees.</div>
    </Card>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <label style={SS.lbl}>Customer-facing description (optional)</label>
        <div style={{background:inv.descriptionOverride?.trim()?OK+"22":BD,color:inv.descriptionOverride?.trim()?OK:WG,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,letterSpacing:"0.04em"}}>{inv.descriptionOverride?.trim()?"SHOWN ON INVOICE":"USING ITEMISED LIST"}</div>
      </div>
      <textarea value={inv.descriptionOverride||""} onChange={e=>setDescOverride(e.target.value)} rows={3}
        placeholder="e.g. Custom 18ct yellow gold bracelet — design, materials & handcrafting"
        style={{...SS.inp,marginTop:0,resize:"vertical",lineHeight:1.6}}/>
      <div style={{fontSize:11,color:WG,marginTop:6,lineHeight:1.5}}>When filled in, the printed invoice shows this single description (with the total) instead of the itemised cost lines below — so the customer doesn't see internal items like "3D Print & Cast". Leave blank to itemise.</div>
    </Card>
    <Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 100px 120px",gap:6,marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${BD}`}}>
        {["Item / Description (internal)","Tax","Amount inc GST"].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
      </div>
      {inv.lineItems.map(li=>(
        <div key={li.id} style={{display:"grid",gridTemplateColumns:"1fr 100px 120px",gap:6,padding:"10px 0",borderBottom:`1px solid ${BD}`,fontSize:13,alignItems:"start"}}>
          <div><div style={{fontWeight:600,color:INK}}>{li.description}</div>{li.detail&&<div style={{fontSize:11,color:WG,marginTop:2}}>{li.detail}</div>}</div>
          <div style={{fontSize:11,color:WG,paddingTop:2}}>GST</div>
          <div style={{fontWeight:700,color:INK,textAlign:"right"}}>{fmt(lineCostLow(li))}</div>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <div style={{minWidth:280}}>
          {[["Includes GST",fmt(inv.gst)]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",color:WG}}><span>{l}</span><span>{v}</span></div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:17,fontWeight:800,color:INK,borderTop:`2px solid ${INK}`,marginTop:8,paddingTop:10}}><span>Total (incl. GST)</span><span>{fmt(inv.totalIncGST)}</span></div>
        </div>
      </div>
      {inv.notes&&<div style={{marginTop:14,fontSize:13,color:WG,fontStyle:"italic",borderTop:`1px solid ${BD}`,paddingTop:10}}>{inv.notes}</div>}
      <div style={{display:"flex",gap:8,marginTop:18,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:WG,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Mark as:</span>
        {["Unpaid","Paid","Overdue"].map(s=><Btn key={s} sm ghost={inv.status!==s} onClick={()=>setStatus(s)}>{inv.status===s?"✓ ":""}{s}</Btn>)}
      </div>
    </Card>
  </div>;
}

function InvoicesList({invoices,jobs,clients,quotes,payments,setInvoices,markupTable,setView}){
  const[modal,setModal]=useState(false);
  const[selClient,setSelClient]=useState("");
  const[selJob,setSelJob]=useState("");
  const[selQuote,setSelQuote]=useState("");
  const clientJobs=selClient?jobs.filter(j=>j.clientId===selClient):[];
  const jobQuotes=selJob?quotes.filter(q=>q.jobId===selJob&&q.status==="Approved"&&!invoices.some(i=>i.quoteId===q.id)):[];
  const openModal=()=>{setSelClient("");setSelJob("");setSelQuote("");setModal(true);};
  const createInv=()=>{
    if(!selQuote)return;
    const q=quotes.find(x=>x.id===selQuote);
    if(!q)return;
    const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);
    const jb=jobs.find(j=>j.id===selJob);
    const totalIncGST=quoteGrandTotal(q,markupTable);        // manual quoted price wins when set
    const gst=totalIncGST-totalIncGST/(1+GST_RATE);          // GST component (= total ÷ 11)
    const exGST=totalIncGST-gst;
    const num=nextInvoiceNumber(invoices);
    const descriptionOverride=q.clientDescription||jb?.description||"";
    const lineItems=[...q.lineItems];   // accent stones already live in lineItems; only the centre stone needs adding
    const centreInc=q.stoneClientTotal||0;
    if(centreInc>0){
      const sDescs=(q.stoneItems||[]).map(s=>(s.description||"").trim()).filter(Boolean);
      const sDetails=(q.stoneItems||[]).map(s=>(s.detail||"").trim()).filter(Boolean);
      lineItems.push({id:uid(),
        description:sDescs.length?sDescs.join(" + "):(q.stoneType==="lab"?"Lab-grown":"Natural")+" diamond / gemstone",
        detail:sDetails.length?sDetails.join(" · "):"Supplied & set",
        costLow:centreInc.toFixed(2),noMarkup:true});
    }
    // A manual-price quote may have no line items — give the invoice one so it isn't blank
    if(!lineItems.length)lineItems.push({id:uid(),description:quoteLabel(q),detail:"As quoted",costLow:totalIncGST.toFixed(2),noMarkup:true});
    const inv={id:uid(),jobId:selJob,quoteId:selQuote,number:num,date:today(),status:"Unpaid",exGST,gst,totalIncGST,lineItems,notes:q.notes||"",descriptionOverride,calc};
    setInvoices(p=>{const n=[...p,inv];persist(K.inv,n);return n;});
    setModal(false);
    setView("invoiceDetail_"+inv.id);
  };
  const delInv=(id,e)=>{e.stopPropagation();const iv=invoices.find(x=>x.id===id);if(!confirm(`Delete invoice ${iv?.number||""}? This can't be undone. Payments and the quote are not affected.`))return;setInvoices(p=>{const n=p.filter(x=>x.id!==id);persist(K.inv,n);return n;});};
  const totalOut=invoices.filter(i=>i.status!=="Paid").reduce((s,i)=>s+i.totalIncGST,0);
  const totalPaid=invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.totalIncGST,0);
  return <div>
    <SectionHeader title="Invoices" action={<Btn onClick={openModal}>+ New Invoice</Btn>}/>
    {invoices.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
      {[["Total invoiced",fmt(totalOut+totalPaid),INK],["Outstanding",fmt(totalOut),totalOut>0?WARN:OK],["Collected",fmt(totalPaid),OK]].map(([l,v,col])=>(
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
      const bal=Math.max(0,inv.totalIncGST-paid);
      return <Card key={inv.id} onClick={()=>setView("invoiceDetail_"+inv.id)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:INK}}>{inv.number}</div>
            <div style={{fontSize:13,color:WG,marginTop:3}}>{job?.type} · {cl?.name} · {fmtDate(inv.date)}</div>
            {bal>0&&inv.status!=="Paid"&&<div style={{fontSize:12,color:WARN,marginTop:2,fontWeight:600}}>Balance owing: {fmt(bal)}</div>}
          </div>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <Badge label={inv.status} color={inv.status==="Paid"?OK:inv.status==="Overdue"?DANGER:WARN}/>
            <div style={{fontWeight:800,fontSize:17,color:INK,textAlign:"right"}}>
              {fmt(inv.totalIncGST)}<div style={{fontSize:11,color:WG,fontWeight:400}}>inc GST</div>
            </div>
            <Btn sm danger onClick={e=>delInv(inv.id,e)}>×</Btn>
          </div>
        </div>
      </Card>;
    })}
    {modal&&<Modal title="New Invoice" onClose={()=>setModal(false)}>
      <div style={{marginBottom:6,fontSize:13,color:WG,lineHeight:1.6}}>Create an invoice from an approved quote. Only approved quotes without an existing invoice are shown.</div>
      <div style={{height:1,background:BD,margin:"14px 0"}}/>
      <div style={{marginBottom:14}}>
        <label style={SS.lbl}>Client</label>
        <select value={selClient} onChange={e=>{setSelClient(e.target.value);setSelJob("");setSelQuote("");}} style={{...SS.inp,marginTop:4}}>
          <option value="">— Select client —</option>
          {clients.filter(cl=>jobs.some(j=>j.clientId===cl.id&&quotes.some(q=>q.jobId===j.id&&q.status==="Approved"&&!invoices.some(i=>i.quoteId===q.id)))).map(cl=><option key={cl.id} value={cl.id}>{cl.name}</option>)}
        </select>
      </div>
      {selClient&&<div style={{marginBottom:14}}>
        <label style={SS.lbl}>Job</label>
        <select value={selJob} onChange={e=>{setSelJob(e.target.value);setSelQuote("");}} style={{...SS.inp,marginTop:4}}>
          <option value="">— Select job —</option>
          {clientJobs.filter(j=>quotes.some(q=>q.jobId===j.id&&q.status==="Approved"&&!invoices.some(i=>i.quoteId===q.id))).map(j=><option key={j.id} value={j.id}>{j.type} · {j.stage}</option>)}
        </select>
      </div>}
      {selJob&&<div style={{marginBottom:18}}>
        <label style={SS.lbl}>Approved Quote</label>
        {jobQuotes.length===0?<div style={{background:"#FFF8E1",border:"1px solid #F0C040",borderRadius:4,padding:"10px 14px",fontSize:13,color:WARN,marginTop:6}}>No approved quotes without an invoice. Go to the job and approve a quote first.</div>
        :<select value={selQuote} onChange={e=>setSelQuote(e.target.value)} style={{...SS.inp,marginTop:4}}>
          <option value="">— Select quote —</option>
          {jobQuotes.map(q=>{const calc=calcQuote(q.lineItems,markupTable,q.markupOverride);const price=quoteIsManual(q)||calc.bracket||calc.overridden||!(calc.base>0)?fmtR(quoteGrandTotal(q,markupTable)):"?";return <option key={q.id} value={q.id}>{quoteLabel(q)} · {price} inc GST</option>;})}
        </select>}
      </div>}
      {selQuote&&(()=>{const q=quotes.find(x=>x.id===selQuote);const calc=q?calcQuote(q.lineItems,markupTable,q.markupOverride):null;return calc&&<div style={{background:OK+"11",border:`1px solid ${OK}44`,borderRadius:4,padding:"12px 16px",marginBottom:18,fontSize:13}}>
        <div style={{fontWeight:700,color:INK,marginBottom:4}}>Invoice summary</div>
        <div style={{color:WG}}>Next invoice number: <strong style={{color:INK}}>{nextInvoiceNumber(invoices)}</strong></div>
        <div style={{color:WG,marginTop:2}}>Amount: <strong style={{color:OK,fontSize:15}}>{fmtR(quoteGrandTotal(q,markupTable))}</strong> inc GST{quoteIsManual(q)&&<span style={{color:GOLD_D,fontWeight:700}}> · manual quoted price</span>}</div>
      </div>;})()}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn ghost onClick={()=>setModal(false)}>Cancel</Btn>
        <Btn disabled={!selQuote} onClick={createInv}>Create Invoice</Btn>
      </div>
    </Modal>}
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
  const[editPrices,setEditPrices]=useState({});
  const setQty=(id,v)=>{
    setQtys(p=>({...p,[id]:v}));
    const item=items.find(x=>x.id===id);
    if(item&&onQtyChange)onQtyChange(id,v,{...item,name:`${item.category} ${item.sizeMm}mm`});
  };
  const sorted=[...items].sort((a,b)=>a.sizeMm-b.sizeMm);
  const startEdit=()=>{const m={};sorted.forEach(i=>{m[i.id]=String(i.baseCost);});setEditPrices(m);setEditing(true);};
  const cancelEdit=()=>setEditing(false);
  const saveEdit=()=>{
    const updated=items.map(x=>({...x,baseCost:Number(editPrices[x.id]??x.baseCost)}));
    onSavePrices(updated);setEditing(false);setEditPrices({});
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
    const cost=editing?(Number(editPrices[item.id])||0):item.baseCost;
    const total=qty&&Number(qty)>0?item.baseCost*Number(qty):null;
    return <div key={item.id} style={{display:"grid",gridTemplateColumns:dcols,padding:"8px 16px",borderBottom:i<len-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"66"}}>
      <div style={{fontWeight:700,fontSize:13,color:INK}}>{item.sizeMm}mm</div>
      <div style={{fontSize:13,color:WG}}>{item.caratWeight}ct</div>
      {editing
        ?<input type="number" value={editPrices[item.id]||""} min="0" step="0.01"
            onChange={e=>setEditPrices(p=>({...p,[item.id]:e.target.value}))}
            style={{width:"84px",padding:"5px 8px",borderRadius:7,border:`1px solid ${GOLD}`,fontSize:13,fontFamily:"inherit",color:GOLD_D,fontWeight:700,background:GOLD_L,outline:"none",textAlign:"right"}}/>
        :<div style={{fontSize:13,fontWeight:700,color:INK}}>{fmt(item.baseCost)}</div>}
      <div style={{fontSize:12,color:WG}}>{fmt(cost/item.caratWeight)}</div>
      <input type="number" value={qty} min="1" step="1" onChange={e=>setQty(item.id,e.target.value)} placeholder="0"
        disabled={editing}
        style={{width:"60px",padding:"5px 8px",borderRadius:7,border:`1px solid ${qty&&!editing?GOLD:BD}`,fontSize:13,fontFamily:"inherit",color:INK,background:editing?"#f5f5f5":WHITE,outline:"none",textAlign:"right",opacity:editing?0.4:1}}/>
      <div style={{fontSize:13,fontWeight:800,color:total&&!editing?OK:WG,textAlign:"right",paddingRight:4}}>{total&&!editing?fmt(total):"—"}</div>
    </div>;
  };
  return <div style={{background:WHITE,borderRadius:14,border:`1px solid ${editing?GOLD:BD}`,overflow:"hidden",transition:"border-color 0.15s"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:editing?GOLD_L:PARCH,borderBottom:`1px solid ${editing?GOLD+"55":BD}`}}>
      <div style={{fontSize:11,fontWeight:700,color:editing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>{editing?"Editing per-stone prices — update then save":"Per stone cost · click ✎ to update prices"}</div>
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

  return <div style={{background:WHITE,borderRadius:14,border:`1px solid ${editing?GOLD:BD}`,overflow:"hidden",transition:"border-color 0.15s"}}>
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

function CADDesignTable({items,onSavePrices,onQtyChange}){
  const tiers=items.filter(x=>x.cadTier);
  const revItem=items.find(x=>x.cadRevision);
  const[editing,setEditing]=useState(false);
  const[fees,setFees]=useState(()=>{const m={};tiers.forEach(t=>{m[t.id]=String(t.baseCost);});return m;});
  const[addRate,setAddRate]=useState(String(revItem?.baseCost||70));
  const[selectedTier,setSelectedTier]=useState(null);
  const[revQty,setRevQty]=useState("");

  const startEdit=()=>{
    const m={};tiers.forEach(t=>{m[t.id]=String(t.baseCost);});
    setFees(m);setAddRate(String(revItem?.baseCost||70));setEditing(true);
  };
  const cancelEdit=()=>setEditing(false);
  const saveEdit=()=>{
    const updated=items.map(item=>{
      if(item.cadTier&&fees[item.id]!==undefined)return{...item,baseCost:Number(fees[item.id])||0};
      if(item.cadRevision)return{...item,baseCost:Number(addRate)||0};
      return item;
    });
    onSavePrices(updated);setEditing(false);
  };

  const selectTier=(tier)=>{
    const next=selectedTier?.id===tier.id?null:tier;
    setSelectedTier(next);
    if(onQtyChange){
      // clear any previously selected tier first
      tiers.forEach(t=>onQtyChange("cad_tier_"+t.id,"0",{...t,name:`CAD Design — ${t.name}`}));
      if(next&&next.id){
        onQtyChange("cad_tier_"+next.id,"1",{...next,name:`CAD Design — ${next.name}`});
      }
    }
  };

  const handleRevQty=(v)=>{
    setRevQty(v);
    const hrs=Number(v)||0;
    const rate=Number(addRate)||revItem?.baseCost||70;
    if(onQtyChange&&revItem){
      onQtyChange("cad_revision",String(hrs),{...revItem,name:"CAD Additional revision",baseCost:rate});
    }
  };

  const TIER_COLORS={
    "None (no charge)":WG,
    "Simple Design":"#5B7FA6",
    "Standard Design":GOLD_D,
    "Complex Design":"#7B5EA7",
  };

  return <div style={{background:WHITE,borderRadius:14,border:`1px solid ${editing?GOLD:BD}`,overflow:"hidden",transition:"border-color 0.15s"}}>
    {/* Toolbar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",background:editing?GOLD_L:PARCH,borderBottom:`1px solid ${editing?GOLD+"55":BD}`}}>
      <div style={{fontSize:11,fontWeight:700,color:editing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>
        {editing?"Editing fees — update then save":"CAD Design · select a tier for the calculator"}
      </div>
      <div style={{display:"flex",gap:8}}>
        {editing
          ?<><Btn sm ghost onClick={cancelEdit}>Cancel</Btn><Btn sm onClick={saveEdit}>Save fees</Btn></>
          :<Btn sm ghost onClick={startEdit}>✎ Edit fees</Btn>}
      </div>
    </div>

    {/* Policy note */}
    <div style={{padding:"12px 18px",borderBottom:`1px solid ${BD}`,background:GOLD_L+"55",fontSize:12,color:GOLD_D,lineHeight:1.6}}>
      Each tier includes CAD design, renderings & 3D model · <strong>2 major revisions</strong> + unlimited minor revisions · Further major revisions charged at the additional hourly rate below.
    </div>

    {/* Tier cards — clickable to select */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:0,borderBottom:`1px solid ${BD}`}}>
      {tiers.map((tier,i)=>{
        const col=TIER_COLORS[tier.name]||WG;
        const isNone=tier.baseCost===0&&!editing;
        const sel=selectedTier?.id===tier.id;
        return <div key={tier.id} onClick={()=>!editing&&selectTier(tier)}
          style={{padding:"18px 18px",borderRight:i<tiers.length-1?`1px solid ${BD}`:"none",
            background:sel?(col+"18"):WHITE,cursor:editing?"default":"pointer",
            outline:sel?`2px solid ${col}`:"none",outlineOffset:"-2px",transition:"all 0.12s"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:sel?col:BD,transition:"background 0.12s",flexShrink:0}}/>
            <div style={{fontSize:12,fontWeight:700,color:sel?col:WG}}>{tier.name}</div>
            {sel&&!editing&&<span style={{marginLeft:"auto",fontSize:10,fontWeight:800,color:col,background:col+"22",padding:"1px 6px",borderRadius:10}}>✓ selected</span>}
          </div>
          {editing
            ?<input type="number" value={fees[tier.id]||""} min="0" step="1"
                onClick={e=>e.stopPropagation()}
                onChange={e=>setFees(p=>({...p,[tier.id]:e.target.value}))}
                style={{...SS.inp,marginTop:0,fontSize:18,fontWeight:800,padding:"8px 10px",color:GOLD_D,border:`1px solid ${GOLD}`,width:"100%"}}/>
            :<div style={{fontSize:22,fontWeight:800,color:isNone?WG:sel?col:INK}}>{isNone?"—":fmt(tier.baseCost)}</div>}
          {!editing&&<div style={{fontSize:11,color:sel?col:WG,marginTop:4}}>{isNone?"no charge":"per job"}</div>}
        </div>;
      })}
    </div>

    {/* Additional revision — rate + qty input */}
    <div style={{padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:12,fontWeight:700,color:INK}}>Additional revision</div>
        <div style={{fontSize:11,color:WG,marginTop:2}}>Major revisions beyond the 2 included · charged per hour</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {editing
          ?<div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>Rate:</span>
              <input type="number" value={addRate} min="0" step="1"
                onChange={e=>setAddRate(e.target.value)}
                style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:800,padding:"6px 10px",color:GOLD_D,border:`1px solid ${GOLD}`,width:90,textAlign:"right"}}/>
              <span style={{fontSize:12,color:WG}}>/hr</span>
            </div>
          :<span style={{fontSize:14,fontWeight:800,color:INK}}>{fmt(Number(addRate)||revItem?.baseCost||70)}<span style={{fontSize:11,fontWeight:400,color:WG}}>/hr</span></span>}
        {!editing&&<div style={{display:"flex",alignItems:"center",gap:8,background:PARCH,borderRadius:8,padding:"8px 12px",border:`1px solid ${revQty&&Number(revQty)>0?GOLD:BD}`}}>
          <label style={{fontSize:11,fontWeight:700,color:WG,whiteSpace:"nowrap"}}>Hrs:</label>
          <input type="number" value={revQty} min="0" step="1" placeholder="0"
            onChange={e=>handleRevQty(e.target.value)}
            style={{width:60,padding:"4px 6px",borderRadius:6,border:`1px solid ${revQty&&Number(revQty)>0?GOLD:BD}`,fontSize:14,fontWeight:800,fontFamily:"inherit",color:INK,background:WHITE,outline:"none",textAlign:"center"}}/>
          {revQty&&Number(revQty)>0&&<span style={{fontSize:13,fontWeight:800,color:OK,whiteSpace:"nowrap"}}>= {fmt((Number(addRate)||70)*Number(revQty))}</span>}
        </div>}
      </div>
    </div>
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

  return <div style={{background:WHITE,borderRadius:14,border:`1px solid ${editing?GOLD:BD}`,overflow:"hidden",transition:"border-color 0.15s"}}>
    {/* Toolbar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",background:editing?GOLD_L:PARCH,borderBottom:`1px solid ${editing?GOLD+"55":BD}`,transition:"background 0.15s"}}>
      <div style={{fontSize:11,fontWeight:700,color:editing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>
        {editing?"Editing rates — update then save":"3D Print & Cast · fee calculator"}
      </div>
      <div style={{display:"flex",gap:8}}>
        {editing
          ?<><Btn sm ghost onClick={cancelEdit}>Cancel</Btn><Btn sm onClick={saveEdit}>Save rates</Btn></>
          :<Btn sm ghost onClick={startEdit}>✎ Edit rates</Btn>}
      </div>
    </div>

    {/* Rate editor */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,padding:"16px 18px",borderBottom:`1px solid ${BD}`,background:editing?GOLD_L+"66":WHITE}}>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Print fee per piece ($)</div>
        {editing
          ?<input type="number" value={printFee} min="0" step="0.01" onChange={e=>setPrintFee(e.target.value)}
              style={{...SS.inp,marginTop:0,fontSize:16,fontWeight:700,padding:"8px 12px",color:GOLD_D,border:`1px solid ${GOLD}`}}/>
          :<div style={{fontSize:20,fontWeight:800,color:INK}}>{fmt(print)}<span style={{fontSize:12,fontWeight:400,color:WG}}>/piece</span></div>}
      </div>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Casting fee per piece ($)</div>
        {editing
          ?<input type="number" value={castFee} min="0" step="0.01" onChange={e=>setCastFee(e.target.value)}
              style={{...SS.inp,marginTop:0,fontSize:16,fontWeight:700,padding:"8px 12px",color:GOLD_D,border:`1px solid ${GOLD}`}}/>
          :<div style={{fontSize:20,fontWeight:800,color:INK}}>{fmt(cast)}<span style={{fontSize:12,fontWeight:400,color:WG}}>/piece</span></div>}
      </div>
    </div>

    {/* Quantity input */}
    <div style={{padding:"16px 18px",borderBottom:`1px solid ${BD}`,background:PARCH+"88",display:"flex",alignItems:"center",gap:16}}>
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
    </div>

    {/* Manual override price */}
    <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,background:usingOverride?GOLD_L+"66":WHITE,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
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
    </div>

    {/* Result breakdown */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"0"}}>
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
    </div>
  </div>;
}

function PricingDB({pricing,setPricing,spotPrices,setSpotPrices,markupTable,centreRates=DEFAULT_CENTRE_RATES,setCentreRates}){
  const[modal,setModal]=useState(null);
  const[cf,setCf]=useState("All");
  const[spotModal,setSpotModal]=useState(false);
  const[selections,setSelections]=useState({});
  const[regQtys,setRegQtys]=useState({});
  const[editingCostId,setEditingCostId]=useState(null);
  const[editingCostVal,setEditingCostVal]=useState("");
  const[dragId,setDragId]=useState(null);
  const[dragOverId,setDragOverId]=useState(null);
  const[savedToast,setSavedToast]=useState(false);
  const[regularEditing,setRegularEditing]=useState(false);
  const[regularEditPrices,setRegularEditPrices]=useState({});
  const[manLabel,setManLabel]=useState("");
  const[manAmt,setManAmt]=useState("");
  const addManualToCalc=()=>{
    const amt=Number(manAmt)||0;if(amt<=0)return;
    const id="man_"+uid();
    setSelections(prev=>({...prev,[id]:{item:{id,name:manLabel.trim()||"Manual amount",baseCost:amt},qty:1}}));
    setManLabel("");setManAmt("");
  };
  const[centreCt,setCentreCt]=useState("");
  const[centreComplex,setCentreComplex]=useState(false);
  const[editRates,setEditRates]=useState(false);
  const[rateDraft,setRateDraft]=useState({basicPerCt:"",complexPerCt:""});
  const startEditRates=()=>{setRateDraft({basicPerCt:String(centreRates.basicPerCt),complexPerCt:String(centreRates.complexPerCt)});setEditRates(true);};
  const saveRates=()=>{
    const nr={basicPerCt:Number(rateDraft.basicPerCt)||0,complexPerCt:Number(rateDraft.complexPerCt)||0};
    setCentreRates&&setCentreRates(nr);persist(K.csr,nr);
    setEditRates(false);showSaved();
    // refresh any live-calc entry with the new rate
    const fee=centreSettingFee(centreCt,centreComplex,nr);
    setSelections(prev=>{const next={...prev};if(fee>0){next["__centre__"]={item:{id:"__centre__",name:`Centre stone setting — ${centreComplex?"complex":"basic"} (${Number(centreCt)}ct)`,baseCost:fee},qty:1};}else{delete next["__centre__"];}return next;});
  };

  const showSaved=()=>{setSavedToast(true);setTimeout(()=>setSavedToast(false),2200);};

  const updateItemCost=(id,val)=>{
    const cost=Number(val);
    if(!val||isNaN(cost)||cost<0)return;
    setPricing(p=>{const n=p.map(x=>x.id===id?{...x,baseCost:cost}:x);persist(K.pr,n);return n;});
    setEditingCostId(null);
    showSaved();
  };

  const isDiamondView=DIAMOND_CATS.includes(cf);
  const isSettingView=cf==="Basic Setting";
  const isComplexSettingView=cf==="Complex Setting";
  const isPrintCastView=cf==="3D Print & Cast";
  const isCADView=cf==="CAD Design";
  const isCentreView=cf===CENTRE_SET_CAT;
  const isAllView=cf==="All";
  const specialCats=[...DIAMOND_CATS,"Basic Setting","Complex Setting","3D Print & Cast","CAD Design"];
  const regularItems=pricing.filter(p=>!specialCats.includes(p.category));
  const filteredRegular=isAllView?regularItems:(!isDiamondView&&!isSettingView&&!isComplexSettingView&&!isPrintCastView&&!isCADView?regularItems.filter(p=>p.category===cf):[]);
  const filteredDiamond=isDiamondView?pricing.filter(p=>p.category===cf):[];
  const filteredSetting=isSettingView?pricing.filter(p=>p.category==="Basic Setting"):[];
  const filteredComplex=isComplexSettingView?pricing.filter(p=>p.category==="Complex Setting"):[];
  const filteredPrintCast=pricing.filter(p=>p.category==="3D Print & Cast");
  const filteredCAD=pricing.filter(p=>p.category==="CAD Design");

  const saveItem=(f,id)=>{setPricing(p=>{const n=id?p.map(x=>x.id===id?{...x,...f}:x):[...p,{...f,id:uid()}];persist(K.pr,n);return n;});setModal(null);};
  const del=id=>{if(!confirm("Delete?"))return;setPricing(p=>{const n=p.filter(x=>x.id!==id);persist(K.pr,n);return n;});};
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

  // callback for table components
  const handleQtyChange=(id,qtyStr,item)=>{
    const q=Number(qtyStr)||0;
    setSelections(prev=>{
      const next={...prev};
      if(q>0){next[id]={item,qty:q};}
      else{delete next[id];}
      return next;
    });
  };

  // Centre stone setting → feed live calc panel as a calculated entry
  const updateCentreSelection=(ct,complex)=>{
    const fee=centreSettingFee(ct,complex,centreRates);
    setSelections(prev=>{
      const next={...prev};
      if(fee>0){
        next["__centre__"]={item:{id:"__centre__",name:`Centre stone setting — ${complex?"complex":"basic"} (${Number(ct)}ct)`,baseCost:fee},qty:1};
      }else{delete next["__centre__"];}
      return next;
    });
  };
  const clearAll=()=>{setSelections({});setCentreCt("");setCentreComplex(false);};

  // Calc panel derived values
  const selEntries=Object.values(selections);
  const markupEntries=selEntries.filter(({item})=>!item.noMarkup);
  const flatEntries=selEntries.filter(({item})=>item.noMarkup);
  const baseCost=markupEntries.reduce((s,{item,qty})=>s+(item.baseCost*qty),0);
  const flatCost=flatEntries.reduce((s,{item,qty})=>s+(item.baseCost*qty),0);
  const mt=markupTable||DEFAULT_MARKUP_TABLE;
  const bracket=mt.find(b=>baseCost>=b.low&&baseCost<=b.high)||null;
  const mult=bracket?.multiplier||null;
  const finalPrice=mult?baseCost*mult:null;
  const hasSelections=selEntries.length>0;
  const DCOLORS={"Lab Grown Diamonds | D-E":"#7B5EA7","Natural diamonds G-H SI1":"#3B6E8F","Natural diamonds D-E VS":"#2D7A4F"};
  return <div>
    <SectionHeader title="Pricing database" action={<Btn onClick={()=>setModal("add")}>+ Add item</Btn>}/>
    {savedToast&&<div style={{position:"fixed",top:18,right:24,background:OK,color:WHITE,fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:10,boxShadow:"0 4px 18px rgba(0,0,0,0.18)",zIndex:9999,display:"flex",alignItems:"center",gap:8}}>
      ✓ Prices saved — all future quotes will use updated figures
    </div>}

    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
      {["All","Metals","Labour","CAD Design","Basic Setting","Complex Setting",CENTRE_SET_CAT,"3D Print & Cast",FINDINGS_CAT,PURCHASED_CAT,...DIAMOND_CATS,REPAIRS_CAT].map(cat=>(
        <button key={cat} onClick={()=>setCf(cat)} style={{padding:"4px 11px",borderRadius:20,border:`1px solid ${cf===cat?(DCOLORS[cat]||GOLD):BD}`,background:cf===cat?(DCOLORS[cat]||GOLD):"transparent",color:cf===cat?WHITE:WG,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{cat}</button>
      ))}
    </div>

    {/* ── Live calculation panel ───────────────────────────────────────── */}
    <div style={{background:hasSelections?INK:PARCH,border:`1px solid ${hasSelections?GOLD+"55":BD}`,borderRadius:14,padding:"16px 20px",marginBottom:18,transition:"all 0.2s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:hasSelections?14:0}}>
        <div style={{fontSize:11,fontWeight:700,color:hasSelections?GOLD:WG,letterSpacing:"0.1em",textTransform:"uppercase"}}>
          {hasSelections?"Live calculation — enter quantities in any table below":"Cost calculator — enter quantities in the tables below to see your base cost and marked-up price"}
        </div>
        {hasSelections&&<button onClick={clearAll} style={{background:"none",border:`1px solid rgba(255,255,255,0.2)`,borderRadius:6,padding:"3px 10px",fontSize:11,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit"}}>Clear all</button>}
      </div>
      {/* Manual amount adder — type any figure (e.g. labour) straight into the calc */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:hasSelections?14:12,marginBottom:hasSelections?14:0,paddingTop:hasSelections?14:12,borderTop:`1px solid ${hasSelections?"rgba(255,255,255,0.12)":BD}`}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:hasSelections?"rgba(255,255,255,0.5)":WG,whiteSpace:"nowrap"}}>Add manual amount</span>
        <input value={manLabel} onChange={e=>setManLabel(e.target.value)} placeholder="Label (e.g. Labour)"
          style={{...SS.inp,marginTop:0,flex:1,minWidth:130,padding:"7px 10px",fontSize:13}}/>
        <div style={{position:"relative",width:120}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>$</span>
          <input type="number" value={manAmt} min="0" step="0.01" placeholder="0.00" onChange={e=>setManAmt(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addManualToCalc();}}
            style={{...SS.inp,marginTop:0,width:"100%",padding:"7px 10px 7px 22px",fontSize:13,textAlign:"right"}}/>
        </div>
        <Btn sm onClick={addManualToCalc}>Add</Btn>
      </div>
      {hasSelections&&<>
        {/* Line items */}
        <div style={{marginBottom:14}}>
          {markupEntries.map(({item,qty})=>(
            <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.08)",fontSize:12}}>
              <span style={{color:"rgba(255,255,255,0.7)"}}>{item.name}{qty>1&&<span style={{color:"rgba(255,255,255,0.35)"}}> × {qty}</span>}</span>
              <span style={{fontWeight:700,color:WHITE}}>{fmt(item.baseCost*qty)}</span>
            </div>
          ))}
          {flatEntries.map(({item,qty})=>(
            <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.08)",fontSize:12}}>
              <span style={{color:"rgba(255,255,255,0.7)"}}>{item.name}{qty>1&&<span style={{color:"rgba(255,255,255,0.35)"}}> × {qty}</span>}<span style={{marginLeft:6,background:"#7B5EA7",color:WHITE,fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,letterSpacing:"0.04em"}}>FLAT</span></span>
              <span style={{fontWeight:700,color:"#C9A8FF"}}>{fmt(item.baseCost*qty)}</span>
            </div>
          ))}
        </div>
        {/* Summary row */}
        {markupEntries.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:0,background:"rgba(255,255,255,0.06)",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",marginBottom:flatEntries.length>0?8:0}}>
          {[
            ["Base cost",fmt(baseCost),"rgba(255,255,255,0.5)",WHITE],
            ["Bracket",bracket?`${fmt(bracket.low)} – ${fmt(bracket.high)}`:"—","rgba(255,255,255,0.5)","rgba(255,255,255,0.7)"],
            ["Multiplier",mult?`${mult}×`:"—","rgba(255,255,255,0.5)",GOLD],
            ["Your price",finalPrice?fmtR(finalPrice):"—","rgba(255,255,255,0.5)",OK],
          ].map(([l,v,lc,vc],i)=>(
            <div key={l} style={{padding:"12px 16px",borderRight:i<3?"1px solid rgba(255,255,255,0.08)":"none"}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:lc,marginBottom:4}}>{l}</div>
              <div style={{fontSize:i===3?22:16,fontWeight:800,color:vc}}>{v}</div>
            </div>
          ))}
        </div>}
        {flatEntries.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(123,94,167,0.15)",border:"1px solid rgba(123,94,167,0.3)",borderRadius:10,padding:"10px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(201,168,255,0.8)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Flat fee total (no markup)</div>
          <div style={{fontSize:20,fontWeight:800,color:"#C9A8FF"}}>{fmtR(flatCost)}</div>
        </div>}
        {!bracket&&baseCost>0&&<div style={{marginTop:10,fontSize:12,color:WARN}}>Base cost is outside your markup table range — check Settings.</div>}
      </>}
    </div>

    {/* Basic Setting view */}
    {isSettingView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"12px 16px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        <strong style={{color:INK}}>Basic Setting — labour cost per stone</strong>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>Fixed setting fee by stone size (AUD) · Applies to all round stones regardless of type — lab grown or natural</span>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>This is a separate cost from the stone price — both lines should appear in your quote.</span>
      </div>
      <SettingTable items={filteredSetting} onSavePrices={saveSettingPrices} label="Basic Setting" onQtyChange={handleQtyChange}/>
    </div>}

    {/* Complex Setting view */}
    {isComplexSettingView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"12px 16px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        <strong style={{color:INK}}>Complex Setting — French Pavé / Channel / Bezel</strong>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>Fixed setting fee by stone size (AUD) · For complex setting styles requiring extra bench time</span>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>This is a separate cost from the stone price — both lines should appear in your quote.</span>
      </div>
      <SettingTable items={filteredComplex} onSavePrices={saveSettingPrices} label="Complex Setting" onQtyChange={handleQtyChange}/>
    </div>}

    {/* Diamond view */}
    {isDiamondView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"12px 16px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        <strong style={{color:DCOLORS[cf]||INK}}>{cf}</strong>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>{DIAMOND_CAT_LABELS[cf]}</span>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>Raw costs per stone — markup applied at quote time via multiplier table. Add a Basic Setting line separately for the setting labour cost.</span>
      </div>
      <DiamondTable items={filteredDiamond} onQtyChange={handleQtyChange} onSavePrices={saveSettingPrices}/>
    </div>}

    {/* 3D Print & Cast view */}
    {isPrintCastView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"12px 16px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        <strong style={{color:INK}}>3D Printing & Casting — fee calculator</strong>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>Fixed fees per piece — edit your rates any time. Both print and cast fees should appear as separate lines in your quote.</span>
      </div>
      <PrintCastTable items={filteredPrintCast} onSavePrices={saveSettingPrices} onQtyChange={handleQtyChange}/>
    </div>}

    {/* CAD Design view */}
    {isCADView&&<div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"12px 16px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        <strong style={{color:INK}}>CAD Design — fee tiers</strong>
        <span style={{display:"block",marginTop:3,fontSize:12,color:WG}}>Select a tier per job · includes CAD design, renderings & 3D model · Fees and revision rate are editable</span>
      </div>
      <CADDesignTable items={filteredCAD} onSavePrices={saveSettingPrices} onQtyChange={handleQtyChange}/>
    </div>}

    {/* Centre Stone Setting view — interactive calculator feeding live calc */}
    {isCentreView&&<div>
      <div style={{background:WHITE,border:`1px solid ${editRates?GOLD:BD}`,borderRadius:12,padding:"14px 18px",marginBottom:14,fontSize:13,lineHeight:1.6}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div>
            <strong style={{color:INK}}>Centre Stone Setting — calculated fee</strong>
            <span style={{display:"block",marginTop:4,fontSize:12,color:WG}}>Centre stones are larger and higher-risk to set, so the fee scales with carat weight. Enter a weight below to feed the live calculation above.</span>
          </div>
          {!editRates&&<Btn sm ghost onClick={startEditRates}>✎ Edit rates</Btn>}
        </div>
        {!editRates
          ?<div style={{marginTop:8,display:"flex",gap:24,flexWrap:"wrap"}}>
            <div style={{fontSize:12,color:INK}}><strong>Basic</strong> = carat × <strong style={{color:"#4A8E6A"}}>{fmt(centreRates.basicPerCt)}</strong>/ct</div>
            <div style={{fontSize:12,color:INK}}><strong>Complex</strong> = carat × <strong style={{color:"#B05C3A"}}>{fmt(centreRates.complexPerCt)}</strong>/ct <span style={{color:WG}}>(pear claws, bezels, fragile / sapphire stones)</span></div>
          </div>
          :<div style={{marginTop:12,background:PARCH,border:`1px solid ${BD}`,borderRadius:10,padding:"14px 16px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              <div>
                <label style={SS.lbl}>Basic setting ($ per carat)</label>
                <div style={{position:"relative",marginTop:4}}>
                  <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>$</span>
                  <input type="number" value={rateDraft.basicPerCt} min="0" step="1" onChange={e=>setRateDraft(d=>({...d,basicPerCt:e.target.value}))}
                    style={{...SS.inp,marginTop:0,padding:"8px 10px 8px 22px",fontSize:14,fontWeight:700}}/>
                </div>
              </div>
              <div>
                <label style={SS.lbl}>Complex setting ($ per carat)</label>
                <div style={{position:"relative",marginTop:4}}>
                  <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>$</span>
                  <input type="number" value={rateDraft.complexPerCt} min="0" step="1" onChange={e=>setRateDraft(d=>({...d,complexPerCt:e.target.value}))}
                    style={{...SS.inp,marginTop:0,padding:"8px 10px 8px 22px",fontSize:14,fontWeight:700}}/>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
              <Btn sm ghost onClick={()=>setEditRates(false)}>Cancel</Btn>
              <Btn sm onClick={saveRates}>Save rates</Btn>
            </div>
          </div>}
      </div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:14,padding:"18px 20px",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:"0 20px",alignItems:"start"}}>
          <div>
            <label style={SS.lbl}>Centre stone carat weight</label>
            <div style={{position:"relative",marginTop:4}}>
              <input type="number" value={centreCt} min="0" step="0.01" placeholder="e.g. 1.50"
                onChange={e=>{setCentreCt(e.target.value);updateCentreSelection(e.target.value,centreComplex);}}
                style={{...SS.inp,marginTop:0,paddingRight:34,fontSize:15,fontWeight:700,textAlign:"right"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:WG,pointerEvents:"none"}}>ct</span>
            </div>
          </div>
          <div>
            <label style={SS.lbl}>Setting type</label>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              {[[false,"Basic","Round diamond, standard claw"],[true,"Complex","Pear claws, bezels, fragile / sapphire"]].map(([val,label,sub])=>(
                <button key={label} onClick={()=>{setCentreComplex(val);updateCentreSelection(centreCt,val);}} style={{
                  flex:1,padding:"10px 14px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",textAlign:"left",
                  border:`2px solid ${centreComplex===val?(val?"#B05C3A":"#4A8E6A"):BD}`,
                  background:centreComplex===val?(val?"#B05C3A11":"#4A8E6A11"):"transparent",transition:"all 0.12s"
                }}>
                  <div style={{fontSize:13,fontWeight:700,color:centreComplex===val?(val?"#B05C3A":"#4A8E6A"):INK}}>{label}</div>
                  <div style={{fontSize:10,color:WG,marginTop:2,lineHeight:1.3}}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${BD}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,color:WG}}>{Number(centreCt)>0?`${Number(centreCt)}ct × ${fmt(centreComplex?centreRates.complexPerCt:centreRates.basicPerCt)}/ct`:"Enter a carat weight to calculate the setting fee"}</div>
          <div style={{fontSize:20,fontWeight:800,color:centreSettingFee(centreCt,centreComplex,centreRates)>0?OK:WG}}>{fmt(centreSettingFee(centreCt,centreComplex,centreRates))}</div>
        </div>
      </div>
      <div style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["Carat weight","Basic fee","Complex fee"].map(h=><div key={h} style={{padding:"10px 16px",fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</div>)}
        </div>
        {[0.5,1,1.5,2,2.5,3,3.5,4,5].map(ct=>(
          <div key={ct} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:`1px solid ${BD}`}}>
            <div style={{padding:"9px 16px",fontSize:13,fontWeight:600,color:INK}}>{ct.toFixed(2)}ct</div>
            <div style={{padding:"9px 16px",fontSize:13,color:INK}}>{fmt(centreSettingFee(ct,false,centreRates))}</div>
            <div style={{padding:"9px 16px",fontSize:13,color:"#B05C3A",fontWeight:600}}>{fmt(centreSettingFee(ct,true,centreRates))}</div>
          </div>
        ))}
      </div>
    </div>}

    {/* Regular items view */}
    {!isDiamondView&&!isSettingView&&!isComplexSettingView&&!isPrintCastView&&!isCADView&&!isCentreView&&<>
      {isAllView&&<div style={{background:WHITE,borderRadius:10,border:`1px solid ${BD}`,padding:"11px 16px",marginBottom:14,fontSize:13,color:WG,lineHeight:1.6}}>
        Raw costs — no markup applied here. The multiplier table handles that at quote time. Select a diamond category or "Basic Setting" to view those price charts.
      </div>}
      {filteredRegular.length>0&&<div style={{background:WHITE,borderRadius:14,border:`1px solid ${regularEditing?GOLD:BD}`,overflow:"hidden",marginBottom:16,transition:"border-color 0.15s"}}>
        {/* Table header bar with edit button */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:regularEditing?GOLD_L:PARCH,borderBottom:`1px solid ${regularEditing?GOLD+"55":BD}`}}>
          <div style={{fontSize:11,fontWeight:700,color:regularEditing?GOLD_D:WG,textTransform:"uppercase",letterSpacing:"0.06em"}}>
            {regularEditing?"Editing prices — update then save":"Drag ⠿ to reorder · click ✎ to update cost prices"}
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
        {/* Column headers */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 60px 110px 90px 90px 60px",padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["Item","Category","Unit","Your cost","Qty","Total",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {(()=>{
          const isRepairsView=cf===REPAIRS_CAT;
          let lastGroup=null;
          return filteredRegular.map((item,i)=>{
            const qty=regQtys[item.id]||"";
            const total=!regularEditing&&qty&&Number(qty)>0?item.baseCost*Number(qty):null;
            const showGroupHeader=isRepairsView&&item.group&&item.group!==lastGroup;
            if(showGroupHeader)lastGroup=item.group;
            const canDrag=!regularEditing;
            const isDragTarget=dragOverId===item.id&&dragId&&dragId!==item.id;
            const row=<div key={item.id}
                draggable={canDrag}
                onDragStart={canDrag?(e=>{setDragId(item.id);e.dataTransfer.effectAllowed="move";}):undefined}
                onDragOver={canDrag?(e=>{e.preventDefault();if(dragOverId!==item.id)setDragOverId(item.id);}):undefined}
                onDragLeave={canDrag?(()=>setDragOverId(o=>o===item.id?null:o)):undefined}
                onDrop={canDrag?(e=>{e.preventDefault();reorderRegular(dragId,item.id);setDragId(null);setDragOverId(null);}):undefined}
                onDragEnd={()=>{setDragId(null);setDragOverId(null);}}
                style={{display:"grid",gridTemplateColumns:"2fr 1fr 60px 110px 90px 90px 60px",padding:"10px 16px",borderBottom:i<filteredRegular.length-1?`1px solid ${BD}`:"none",borderTop:isDragTarget?`2px solid ${GOLD}`:"2px solid transparent",alignItems:"center",opacity:dragId===item.id?0.4:1,background:isDragTarget?GOLD_L+"66":"transparent",transition:"background 0.1s"}}>
                <div style={{fontWeight:600,fontSize:13,color:INK,display:"flex",alignItems:"center",gap:8}}>{canDrag&&<span title="Drag to reorder" style={{cursor:"grab",color:WG,fontSize:14,lineHeight:1,flexShrink:0}}>⠿</span>}{item.name}</div>
                <div><Badge label={item.category} color={WG}/></div>
                <div style={{fontSize:12,color:WG}}>/{item.unit}</div>
                <div>
                  {regularEditing
                    ?<input type="number" value={regularEditPrices[item.id]||""} min="0" step="0.01" autoFocus={i===0}
                        onChange={e=>setRegularEditPrices(p=>({...p,[item.id]:e.target.value}))}
                        style={{width:"90px",padding:"5px 8px",borderRadius:7,border:`1px solid ${GOLD}`,fontSize:13,fontFamily:"inherit",color:GOLD_D,fontWeight:700,background:GOLD_L,outline:"none",textAlign:"right"}}/>
                    :<span style={{fontSize:13,fontWeight:700,color:INK}}>{fmt(item.baseCost)}</span>}
                </div>
                <input type="number" value={qty} min="0" step={item.unit==="g"?"0.1":"1"} placeholder="0"
                  disabled={regularEditing}
                  onChange={e=>{
                    const v=e.target.value;
                    setRegQtys(p=>({...p,[item.id]:v}));
                    handleQtyChange(item.id,v,{...item,name:`${item.name} (${v} ${item.unit})`});
                  }}
                  style={{width:"72px",padding:"5px 8px",borderRadius:7,border:`1px solid ${qty&&!regularEditing?GOLD:BD}`,fontSize:13,fontFamily:"inherit",color:INK,background:regularEditing?"#f5f5f5":WHITE,outline:"none",textAlign:"right",opacity:regularEditing?0.4:1}}/>
                <div style={{fontSize:13,fontWeight:800,color:total?OK:WG,textAlign:"right",paddingRight:4}}>{total?fmt(total):"—"}</div>
                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                  {!regularEditing&&<Btn sm danger onClick={()=>del(item.id)}>×</Btn>}
                </div>
              </div>;
            if(!showGroupHeader)return row;
            return [
              <div key={item.id+"_g"} style={{display:"grid",gridTemplateColumns:"2fr 1fr 60px 110px 90px 90px 60px",padding:"7px 16px",background:PARCH,borderTop:i>0?`1px solid ${BD}`:"none",borderBottom:`1px solid ${BD}`}}>
                <div style={{gridColumn:"1/-1",fontSize:10,fontWeight:800,color:GOLD_D,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.group}</div>
              </div>,
              row
            ];
          });
        })()}
      </div>}
      {isAllView&&<div style={{marginTop:4}}>
        <div style={{fontSize:11,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Setting &amp; diamond price tables</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
          {/* CAD Design card */}
          {(()=>{
            const tiers=pricing.filter(p=>p.cadTier&&p.baseCost>0);
            const rev=pricing.find(p=>p.cadRevision);
            return <div onClick={()=>setCf("CAD Design")} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD} onMouseLeave={e=>e.currentTarget.style.borderColor=BD}>
              <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>CAD Design</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>{tiers.length} tiers · {fmt(tiers[0]?.baseCost)} – {fmt(tiers[tiers.length-1]?.baseCost)}<br/>2 major revisions included · {fmt(rev?.baseCost||70)}/hr after<br/><span style={{color:WG}}>Includes None (no charge) option</span></div>
              <div style={{fontSize:11,color:GOLD_D,fontWeight:700,marginTop:8}}>View tiers →</div>
            </div>;
          })()}
          {/* 3D Print & Cast card */}
          {(()=>{
            const pc=pricing.find(p=>p.name==="3D print fee");
            const cc=pricing.find(p=>p.name==="Casting fee");
            return <div onClick={()=>setCf("3D Print & Cast")} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD} onMouseLeave={e=>e.currentTarget.style.borderColor=BD}>
              <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>3D Print & Cast</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>Print: <strong style={{color:INK}}>{fmt(pc?.baseCost||60)}/piece</strong> · Cast: <strong style={{color:INK}}>{fmt(cc?.baseCost||15)}/piece</strong><br/><span style={{color:WG}}>Rates editable · qty-based calculator</span></div>
              <div style={{fontSize:11,color:GOLD_D,fontWeight:700,marginTop:8}}>View calculator →</div>
            </div>;
          })()}
          {/* Basic Setting card */}
          {(()=>{
            const its=pricing.filter(p=>p.category==="Basic Setting").sort((a,b)=>a.sizeMm-b.sizeMm);
            return <div onClick={()=>setCf("Basic Setting")} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD} onMouseLeave={e=>e.currentTarget.style.borderColor=BD}>
              <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>Basic Setting</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>{its.length} sizes · {its[0]?.sizeMm}mm – {its[its.length-1]?.sizeMm}mm<br/>Setting labour: {fmt(its[0]?.baseCost)} – {fmt(its[its.length-1]?.baseCost)}/stone<br/><span style={{color:WG}}>Applies to all stone types</span></div>
              <div style={{fontSize:11,color:GOLD_D,fontWeight:700,marginTop:8}}>View chart →</div>
            </div>;
          })()}
          {/* Complex Setting card */}
          {(()=>{
            const its=pricing.filter(p=>p.category==="Complex Setting").sort((a,b)=>a.sizeMm-b.sizeMm);
            return <div onClick={()=>setCf("Complex Setting")} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD} onMouseLeave={e=>e.currentTarget.style.borderColor=BD}>
              <div style={{fontSize:12,fontWeight:700,color:INK,marginBottom:6}}>Complex Setting</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>{its.length} sizes · {its[0]?.sizeMm}mm – {its[its.length-1]?.sizeMm}mm<br/>Setting labour: {fmt(its[0]?.baseCost)} – {fmt(its[its.length-1]?.baseCost)}/stone<br/><span style={{color:WG}}>French Pavé · Channel · Bezel</span></div>
              <div style={{fontSize:11,color:GOLD_D,fontWeight:700,marginTop:8}}>View chart →</div>
            </div>;
          })()}
          {DIAMOND_CATS.map(cat=>{
            const its=pricing.filter(p=>p.category===cat).sort((a,b)=>a.sizeMm-b.sizeMm);
            const col=DCOLORS[cat]||WG;
            return <div key={cat} onClick={()=>setCf(cat)} style={{background:WHITE,border:`1px solid ${col}44`,borderRadius:12,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=col} onMouseLeave={e=>e.currentTarget.style.borderColor=col+"44"}>
              <div style={{fontSize:12,fontWeight:700,color:col,marginBottom:6}}>{cat}</div>
              <div style={{fontSize:11,color:WG,lineHeight:1.7}}>{its.length} sizes · {its[0]?.sizeMm}mm – {its[its.length-1]?.sizeMm}mm<br/>{fmt(its[0]?.baseCost)} – {fmt(its[its.length-1]?.baseCost)} per stone</div>
              <div style={{fontSize:11,color:col,fontWeight:700,marginTop:8}}>View chart →</div>
            </div>;
          })}
        </div>
      </div>}
    </>}
    {modal&&<Modal title={modal==="add"?"New pricing item":"Edit item"} onClose={()=>setModal(null)}>
      <PricingItemForm initial={modal==="add"?{}:modal} onSave={f=>saveItem(f,modal==="add"?null:modal.id)} onCancel={()=>setModal(null)}/>
    </Modal>}
    {spotModal&&<Modal title="Update metal spot prices" onClose={()=>setSpotModal(false)}>
      <SpotPriceUpdater spotPrices={spotPrices} setSpotPrices={setSpotPrices} pricing={pricing} setPricing={setPricing} onClose={()=>setSpotModal(false)}/>
    </Modal>}
  </div>;
}

function PricingItemForm({initial={},onSave,onCancel}){
  const[f,setF]=useState({category:PCAT[0],name:"",unit:"stone",baseCost:"",detail:"",group:"",...initial});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const isAccent=f.category==="Accent Stones";
  const isRepair=f.category===REPAIRS_CAT;
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Input label="Category" value={f.category} onChange={v=>{setF(p=>({...p,category:v,group:""}));}} as="select" options={PCAT.filter(c=>c!=="Accent Stones"||f.category==="Accent Stones")}/>
      {!isAccent&&<Input label="Unit" value={f.unit} onChange={set("unit")} as="select" options={["job","g","stone","ct","item","pair","hr","piece","set"]}/>}
    </div>
    {isRepair&&<Input label="Group" value={f.group||""} onChange={set("group")} as="select" options={["(no group)",...REPAIR_GROUPS]}/>}
    <Input label="Item name / description" value={f.name} onChange={set("name")} placeholder={isAccent?"e.g. 2mm blue sapphires":"e.g. 9ct white gold"}/>
    {isAccent
      ?<>
        <Input label="Notes / detail (optional)" value={f.detail||""} onChange={set("detail")} placeholder="e.g. heat treated, round, supplier XYZ"/>
        <div style={{background:"#EEF4FB",border:"1px solid #C8DFF0",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#3B6E8F",marginBottom:14}}>
          Cost is entered per quote — accent stone prices vary job to job.
        </div>
      </>
      :<Input label="Your cost per unit ($)" value={f.baseCost} onChange={set("baseCost")} type="number" min="0" step="0.01"/>
    }
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn ghost onClick={onCancel}>Cancel</Btn>
      <Btn onClick={()=>{
        if(!f.name.trim())return alert("Name required");
        if(!isAccent&&!f.baseCost)return alert("Cost required");
        const saved={...f,noMarkup:isRepair?true:f.noMarkup};
        if(isRepair&&saved.group==="(no group)")saved.group="";
        onSave(saved);
      }}>Save item</Btn>
    </div>
  </div>;
}

function SpotPriceUpdater({spotPrices,setSpotPrices,pricing,setPricing,onClose}){
  const[g,setG]=useState(String(spotPrices.gold));
  const[pt,setPt]=useState(String(spotPrices.platinum));
  const[ag,setAg]=useState(String(spotPrices.silver));
  const apply=()=>{
    const ns={gold:Number(g),platinum:Number(pt),silver:Number(ag),updatedAt:today()};
    setSpotPrices(ns);persist(K.spot,ns);
    setPricing(prev=>{const u=prev.map(item=>{if(item.category!=="Metals"||!item.metalKey||item.purity==null)return item;const sv=ns[item.metalKey];if(!sv)return item;return{...item,baseCost:Number((sv*item.purity).toFixed(4))};});persist(K.pr,u);return u;});
    onClose();
  };
  return <div>
    <div style={{background:GOLD_L,borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:GOLD_D,lineHeight:1.6}}>Enter today's fine metal spot price per gram (AUD). All metal pricing items update automatically based on purity.</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
      <Input label="Fine gold ($/g)" value={g} onChange={setG} type="number" min="0" step="0.01"/>
      <Input label="Platinum ($/g)" value={pt} onChange={setPt} type="number" min="0" step="0.01"/>
      <Input label="Silver ($/g)" value={ag} onChange={setAg} type="number" min="0" step="0.01"/>
    </div>
    <div style={{background:PARCH,borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13}}>
      <div style={{fontWeight:700,color:INK,marginBottom:8}}>Preview</div>
      {[{n:"9ct yellow gold",k:"gold",p:0.375},{n:"18ct gold (all alloys)",k:"gold",p:0.75},{n:"Platinum 950",k:"platinum",p:0.95},{n:"Silver 925",k:"silver",p:0.925}].map(m=>{
        const spot=m.k==="gold"?Number(g):m.k==="platinum"?Number(pt):Number(ag);
        return <div key={m.n} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:`1px solid ${BD}`}}>
          <span style={{color:WG}}>{m.n}</span><span style={{fontWeight:700,color:INK}}>{fmt(spot*m.p)}/g</span>
        </div>;
      })}
    </div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn ghost onClick={onClose}>Cancel</Btn><Btn onClick={apply}>Apply prices</Btn></div>
  </div>;
}

// ── Reports ───────────────────────────────────────────────────────────────
function Reports({jobs,clients,quotes,payments,invoices,markupTable}){
  const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);return d.toISOString().slice(0,7);}).reverse();
  const monthData=months.map(m=>({
    month:new Date(m+"-01").toLocaleDateString("en-AU",{month:"short",year:"numeric"}),
    paid:payments.filter(p=>p.date?.startsWith(m)&&p.status==="Received").reduce((s,p)=>s+Number(p.amount),0),
  }));
  const maxPaid=Math.max(...monthData.map(m=>m.paid),1);
  const jobsByType=JOB_TYPES.map(t=>({type:t,count:jobs.filter(j=>j.type===t).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
  const jobsByStage=JOB_STAGES.map(s=>({stage:s,count:jobs.filter(j=>j.stage===s).length})).filter(x=>x.count>0);
  const totalQ=quotes.length;
  const appQ=quotes.filter(q=>q.status==="Approved").length;
  const conv=totalQ>0?Math.round(appQ/totalQ*100):0;
  const avgBase=totalQ>0?quotes.reduce((s,q)=>s+calcQuote(q.lineItems,markupTable,q.markupOverride).baseLow,0)/totalQ:0;
  const avgFinal=totalQ>0?quotes.reduce((s,q)=>{if(quoteIsManual(q))return s+Number(q.manualTotal);const c=calcQuote(q.lineItems,markupTable,q.markupOverride);return s+(c.bracket?(c.isRange?c.finalHigh:c.finalLow):0);},0)/totalQ:0;
  const totalPaid=payments.filter(p=>p.status==="Received").reduce((s,p)=>s+Number(p.amount),0);
  // Sales = agreed charge across all jobs (override or approved quotes)
  const totalSales=jobs.reduce((s,j)=>s+jobChargeTotal(j,quotes,markupTable),0);
  const outstanding=jobs.reduce((s,j)=>{
    const bal=jobChargeTotal(j,quotes,markupTable)-payments.filter(p=>p.jobId===j.id&&p.status==="Received").reduce((a,p)=>a+Number(p.amount),0);
    return s+(bal>1?bal:0);
  },0);
  return <div>
    <SectionHeader title="Reports"/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
      <Stat label="Total clients" value={clients.length}/>
      <Stat label="Total jobs" value={jobs.length}/>
      <Stat label="Total sales" value={fmt(totalSales)} sub="agreed charges"/>
      <Stat label="Quote conversion" value={`${conv}%`} sub={`${appQ} of ${totalQ} approved`}/>
      <Stat label="Avg base cost" value={fmt(avgBase)}/>
      <Stat label="Avg final price" value={fmt(avgFinal)}/>
      <Stat label="Total received" value={fmt(totalPaid)}/>
      <Stat label="Outstanding" value={fmt(outstanding)} sub="balance owed" accent={outstanding>0}/>
    </div>
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:18}}>Payments received — last 6 months</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end",height:110}}>
        {monthData.map(m=>(
          <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{fontSize:10,fontWeight:700,color:m.paid>0?OK:BD,whiteSpace:"nowrap"}}>{m.paid>0?fmt(m.paid):""}</div>
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
  </div>;
}

// ── Settings ──────────────────────────────────────────────────────────────
function Settings({biz,setBiz,markupTable,setMarkupTable,naturalStoneMarkup,setNaturalStoneMarkup,labStoneMarkup,setLabStoneMarkup}){
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
  const saveBiz=()=>{const nb={...bForm,markupBuffer:biz.markupBuffer||0,quoteRounding:biz.quoteRounding||0};setBiz(nb);persist(K.biz,nb);showToast("Business details saved");};
  const saveMt=()=>{setMarkupTable(mt);persist(K.mt,mt);const nb={...biz,markupBuffer:Number(buffer)||0,quoteRounding:Number(rounding)||0};setBiz(nb);persist(K.biz,nb);setMarkupBuffer(Number(buffer)||0);setQuoteRounding(Number(rounding)||0);showToast("Markup table saved");};
  const saveSmNTable=()=>{setNaturalStoneMarkup(smn);persist(K.smn,smn);showToast("Natural stone markup saved");};
  const saveSmLTable=()=>{setLabStoneMarkup(sml);persist(K.sml,sml);showToast("Lab-grown stone markup saved");};

  return <div>
    {toast&&<div style={{position:"fixed",top:18,right:24,background:OK,color:WHITE,fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:4,boxShadow:"0 4px 18px rgba(0,0,0,0.18)",zIndex:9999,letterSpacing:"0.04em"}}>✓ {toast}</div>}
    <SectionHeader title="Settings"/>
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:4}}>Business details</div>
      <div style={{fontSize:13,color:WG,marginBottom:16}}>These appear on printed proposals and invoices.</div>
      {/* Logo uploader */}
      <div style={{marginBottom:18}}>
        <label style={SS.lbl}>Business logo</label>
        <div style={{display:"flex",alignItems:"center",gap:16,marginTop:8}}>
          <div style={{width:90,height:90,borderRadius:14,border:`1px solid ${BD}`,background:PARCH,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
            {bForm.logo?<img src={bForm.logo} alt="Logo" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:<span style={{fontSize:11,color:WG}}>No logo</span>}
          </div>
          <div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <label style={{background:INK,color:WHITE,borderRadius:999,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
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
        <Input label="ABN" value={bForm.abn} onChange={setBF("abn")} placeholder="12 345 678 901"/>
      </div>
      <Input label="Address" value={bForm.address} onChange={setBF("address")} placeholder="123 Collins St, Melbourne VIC 3000"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Input label="Deposit required (%)" value={String(bForm.depositPercent)} onChange={v=>setBF("depositPercent")(Number(v)||50)} type="number" placeholder="50"/>
        <Input label="Quote validity (days)" value={String(bForm.quoteValidityDays)} onChange={v=>setBF("quoteValidityDays")(Number(v)||30)} type="number" placeholder="30"/>
      </div>
      <Input label="Terms & conditions (shown on quote proposals)" value={bForm.quoteTerms} onChange={setBF("quoteTerms")} as="textarea" rows={5} placeholder="All custom jewellery requires a deposit before work commences..."/>
      <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${BD}`}}>
        <div style={{fontSize:10,fontWeight:700,color:WG,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Bank &amp; payment details <span style={{fontWeight:400,color:WG,textTransform:"none",letterSpacing:0}}>(shown on printed invoices)</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Input label="Bank name" value={bForm.bankName||""} onChange={setBF("bankName")} placeholder="Commonwealth Bank of Australia"/>
          <Input label="Account name" value={bForm.bankAccountName||""} onChange={setBF("bankAccountName")} placeholder="VAHÉ Jewellery"/>
          <Input label="BSB" value={bForm.bankBSB||""} onChange={setBF("bankBSB")} placeholder="063 626"/>
          <Input label="Account number" value={bForm.bankAccount||""} onChange={setBF("bankAccount")} placeholder="1051 9975"/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={saveBiz}>Save business details</Btn></div>
    </Card>

    {/* Markup table editor */}
    <Card>
      <div style={{fontWeight:700,fontSize:15,color:INK,marginBottom:4}}>Markup table</div>
      <div style={{fontSize:13,color:WG,marginBottom:16,lineHeight:1.6}}>Your tiered multiplier table. The quote builder uses this to find the right bracket and calculate your final price automatically. Adjust any row and save.</div>
      <div style={{background:WHITE,borderRadius:12,border:`1px solid ${BD}`,overflow:"hidden",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 120px",padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["Cost from ($)","Cost to ($)","Multiplier"].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {mt.map((b,i)=>{
          const exGST=1000;
          const finalEx=exGST*b.multiplier;
          return <div key={b.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 120px",padding:"8px 16px",borderBottom:i<mt.length-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"88"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG,marginRight:2}}>$</span>
              <input type="number" value={b.low} onChange={e=>setMtRow(b.id,"low",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:100}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG,marginRight:2}}>$</span>
              <input type="number" value={b.high} onChange={e=>setMtRow(b.id,"high",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:100}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={b.multiplier} onChange={e=>setMtRow(b.id,"multiplier",Number(e.target.value))} step="0.1" min="1" style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:700,padding:"5px 8px",width:70,color:GOLD_D}}/>
              <span style={{fontSize:11,color:WG}}>×</span>
            </div>
          </div>;
        })}
      </div>
      <div style={{background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:10,padding:"14px 16px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div style={{flexShrink:0}}>
            <label style={SS.lbl}>Bracket threshold buffer ($)</label>
            <div style={{position:"relative",width:130,marginTop:4}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:WG,pointerEvents:"none"}}>$</span>
              <input type="number" value={buffer} onChange={e=>setBuffer(e.target.value)} min="0" step="10" style={{...SS.inp,marginTop:0,padding:"8px 10px 8px 22px",fontWeight:700}}/>
            </div>
          </div>
          <div style={{flex:1,minWidth:220,fontSize:12,color:GOLD_D,lineHeight:1.6}}>
            If a cost is within this much of the next bracket, it's bumped up to that bracket's (lower) multiplier — so a cost just under a threshold doesn't get charged the higher markup. Set to <strong>0</strong> to disable. Example: a $100 buffer means a $920 cost is priced as if it were in the $1,000+ bracket.
          </div>
        </div>
      </div>
      <div style={{background:GOLD_L,border:`1px solid ${GOLD}55`,borderRadius:10,padding:"14px 16px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div style={{flexShrink:0}}>
            <label style={SS.lbl}>Round quote prices</label>
            <select value={rounding} onChange={e=>setRounding(e.target.value)} style={{...SS.inp,marginTop:4,width:170,fontWeight:700}}>
              <option value="0">Off — exact figures</option>
              <option value="5">Nearest $5</option>
              <option value="10">Nearest $10</option>
              <option value="25">Nearest $25</option>
              <option value="50">Nearest $50</option>
              <option value="100">Nearest $100</option>
            </select>
          </div>
          <div style={{flex:1,minWidth:220,fontSize:12,color:GOLD_D,lineHeight:1.6}}>
            Rounds every calculated quote price — jewellery, stones and totals — so quotes don't land on odd figures. Example: nearest $10 turns <strong>$4,587</strong> into <strong>$4,590</strong>; nearest $50 makes it <strong>$4,600</strong>. Manual quoted prices are never rounded. Applies everywhere prices are recalculated, including existing quotes.
          </div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={saveMt}>Save markup table</Btn></div>
    </Card>

    {/* Stone markup tables */}
    <div style={{marginBottom:10,paddingTop:4}}>
      <div style={{fontSize:13,fontWeight:700,color:INK,marginBottom:4}}>Stone markup tables</div>
      <div style={{fontSize:13,color:WG,lineHeight:1.6}}>Two separate markup tables for centre &amp; feature stones — one for natural, one for lab-grown. Applied in the quote builder based on stone type. GST (10%) is added at invoice time on top of the marked-up price.</div>
    </div>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <div style={{background:"#3B6E8F",color:WHITE,borderRadius:2,padding:"2px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Natural Diamond &amp; Gemstone</div>
        <div style={{fontSize:11,color:WG}}>3.00× down to 1.20×</div>
      </div>
      <div style={{fontSize:12,color:WG,marginBottom:14,lineHeight:1.5}}>"Natural" is selected in the quote builder stone section. <strong style={{color:INK}}>GST added at invoice time.</strong></div>
      <div style={{background:WHITE,borderRadius:4,border:`1px solid ${BD}`,overflow:"hidden",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 130px 44px",padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["Cost from ($)","Cost to ($)","Multiplier",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {smn.map((b,i)=>(
          <div key={b.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 130px 44px",padding:"8px 16px",borderBottom:i<smn.length-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"88"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.low} onChange={e=>setSmNRow(b.id,"low",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:100}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.high} onChange={e=>setSmNRow(b.id,"high",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:100}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={b.multiplier} onChange={e=>setSmNRow(b.id,"multiplier",Number(e.target.value))} step="0.01" min="1"
                style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:700,padding:"5px 8px",width:80,color:"#3B6E8F"}}/>
              <span style={{fontSize:11,color:WG}}>×</span>
            </div>
            <button onClick={()=>delSmNRow(b.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,justifySelf:"center"}}>×</button>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={addSmNRow} style={{background:"none",border:"1px dashed #3B6E8F",borderRadius:4,padding:"6px 14px",color:"#3B6E8F",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add tier</button>
        <Btn onClick={saveSmNTable}>Save natural stone markup</Btn>
      </div>
    </Card>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <div style={{background:"#7B5EA7",color:WHITE,borderRadius:2,padding:"2px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Lab-Grown Diamond &amp; Gemstone</div>
        <div style={{fontSize:11,color:WG}}>4.25× down to 1.20×</div>
      </div>
      <div style={{fontSize:12,color:WG,marginBottom:14,lineHeight:1.5}}>"Lab-Grown" is selected in the quote builder stone section. <strong style={{color:INK}}>GST added at invoice time.</strong></div>
      <div style={{background:WHITE,borderRadius:4,border:`1px solid ${BD}`,overflow:"hidden",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 130px 44px",padding:"9px 16px",background:PARCH,borderBottom:`1px solid ${BD}`}}>
          {["Cost from ($)","Cost to ($)","Multiplier",""].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:WG,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
        </div>
        {sml.map((b,i)=>(
          <div key={b.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 130px 44px",padding:"8px 16px",borderBottom:i<sml.length-1?`1px solid ${BD}`:"none",alignItems:"center",background:i%2===0?WHITE:PARCH+"88"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.low} onChange={e=>setSmLRow(b.id,"low",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:100}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:WG}}>$</span>
              <input type="number" value={b.high} onChange={e=>setSmLRow(b.id,"high",Number(e.target.value))} style={{...SS.inp,marginTop:0,fontSize:13,padding:"5px 8px",width:100}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={b.multiplier} onChange={e=>setSmLRow(b.id,"multiplier",Number(e.target.value))} step="0.01" min="1"
                style={{...SS.inp,marginTop:0,fontSize:14,fontWeight:700,padding:"5px 8px",width:80,color:"#7B5EA7"}}/>
              <span style={{fontSize:11,color:WG}}>×</span>
            </div>
            <button onClick={()=>delSmLRow(b.id)} style={{background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:16,padding:0,justifySelf:"center"}}>×</button>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={addSmLRow} style={{background:"none",border:"1px dashed #7B5EA7",borderRadius:4,padding:"6px 14px",color:"#7B5EA7",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add tier</button>
        <Btn onClick={saveSmLTable}>Save lab-grown stone markup</Btn>
      </div>
    </Card>
  </div>;
}

// ── Appointments ───────────────────────────────────────────────────────────
const apptName=(a,clients)=>{const c=a.clientId&&clients.find(x=>x.id===a.clientId);return c?c.name:(a.clientName||"—");};
function MiniBtn({label,color,onClick}){
  return <button onClick={e=>{e.stopPropagation();onClick();}} style={{background:color+"14",border:`1px solid ${color}44`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>;
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
  const pill=(val,label)=><button key={val} onClick={()=>setMode(val)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${mode===val?GOLD:BD}`,background:mode===val?GOLD:"transparent",color:mode===val?WHITE:WG,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>;
  const navBtn=(label,onClick)=><button onClick={onClick} style={{background:WHITE,border:`1px solid ${BD}`,borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:700,color:INK,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>;

  const renderList=()=>{
    const upcoming=sorted.filter(a=>isLiveAppt(a)&&a.date>=tISO);
    const past=sorted.filter(a=>!(isLiveAppt(a)&&a.date>=tISO)).reverse();
    const list=showPast?past:upcoming;
    const days=[...new Set(list.map(a=>a.date))];
    return <div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        <button onClick={()=>setShowPast(false)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${!showPast?GOLD:BD}`,background:!showPast?GOLD:"transparent",color:!showPast?WHITE:WG,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Upcoming ({upcoming.length})</button>
        <button onClick={()=>setShowPast(true)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${showPast?GOLD:BD}`,background:showPast?GOLD:"transparent",color:showPast?WHITE:WG,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Past &amp; resolved ({past.length})</button>
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
                    <MiniBtn label="✓ Done" color={OK} onClick={()=>setStatus(a.id,"Completed")}/>
                    <MiniBtn label="No-show" color={DANGER} onClick={()=>setStatus(a.id,"No-show")}/>
                    <MiniBtn label="Cancel" color={WARN} onClick={()=>setStatus(a.id,"Cancelled")}/>
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
          return <div key={d} onClick={()=>setModal({prefillDate:d})} style={{background:WHITE,border:`1px solid ${isT?GOLD:BD_SOFT}`,borderRadius:12,minHeight:160,padding:"10px 9px",cursor:"pointer"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em",color:isT?GOLD:WG,marginBottom:8}}>{parseISO(d).toLocaleDateString("en-AU",{weekday:"short"})} {parseISO(d).getDate()}</div>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:BD,border:`1px solid ${BD}`,borderRadius:12,overflow:"hidden"}}>
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
    <SectionHeader title="Appointments" action={<Btn onClick={()=>setModal("add")}>+ New appointment</Btn>}/>
    <div style={{display:"flex",gap:6,marginBottom:18}}>{pill("list","List")}{pill("week","Week")}{pill("month","Month")}</div>
    {mode==="list"?renderList():mode==="week"?renderWeek():renderMonth()}
    {modal&&<Modal title={isEdit?"Edit appointment":"New appointment"} onClose={()=>setModal(null)}>
      <AppointmentForm clients={clients} jobs={jobs} initial={modalInitial} onSave={f=>save(f,isEdit?modal.id:null)} onCancel={()=>setModal(null)}/>
    </Modal>}
  </div>;
}

// ── Nav + App shell ───────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",label:"Dashboard",icon:"⬡"},
  {id:"appointments",label:"Appointments",icon:"◷"},
  {id:"clients",label:"Clients",icon:"◈"},
  {id:"jobs",label:"Jobs",icon:"◎"},
  {id:"quotes",label:"Quotes",icon:"◇"},
  {id:"invoices",label:"Invoices",icon:"◉"},
  {id:"pricing",label:"Pricing DB",icon:"◆"},
  {id:"reports",label:"Reports",icon:"▦"},
  {id:"settings",label:"Settings",icon:"⚙"},
];

// ── Login screen ──────────────────────────────────────────────────────────
function Login(){
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState("");
  const submit=async(e)=>{
    e&&e.preventDefault();
    if(!email.trim()||!password)return setErr("Enter your email and password.");
    setBusy(true);setErr("");
    const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    setBusy(false);
    if(error)setErr(error.message||"Sign in failed.");
  };
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#000000",fontFamily:"'DM Sans',sans-serif",padding:20}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:360,background:"#0E0E0E",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"36px 32px"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:8,fontWeight:700,color:GOLD,letterSpacing:"0.28em",textTransform:"uppercase",marginBottom:8,opacity:0.85}}>Studio Platform</div>
        <div style={{fontSize:30,fontWeight:300,color:WHITE,letterSpacing:"0.2em"}}>VAHÉ</div>
      </div>
      <label style={{...SS.lbl,color:"rgba(255,255,255,0.5)"}}>Email</label>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus placeholder="you@studio.com"
        style={{...SS.inp,marginTop:4,marginBottom:14,background:"#161616",border:"1px solid rgba(255,255,255,0.12)",color:WHITE}}/>
      <label style={{...SS.lbl,color:"rgba(255,255,255,0.5)"}}>Password</label>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
        style={{...SS.inp,marginTop:4,marginBottom:18,background:"#161616",border:"1px solid rgba(255,255,255,0.12)",color:WHITE}}/>
      {err&&<div style={{background:DANGER+"22",border:`1px solid ${DANGER}55`,color:"#FF9B91",fontSize:12,padding:"9px 12px",borderRadius:8,marginBottom:14}}>{err}</div>}
      <button type="submit" disabled={busy} style={{width:"100%",background:busy?"#7A5F0F":GOLD,color:WHITE,border:"none",borderRadius:8,padding:"11px",fontSize:14,fontWeight:700,cursor:busy?"default":"pointer",fontFamily:"inherit",letterSpacing:"0.04em"}}>
        {busy?"Signing in…":"Sign in"}
      </button>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center",marginTop:16,lineHeight:1.6}}>Accounts are created by your studio administrator.</div>
    </form>
  </div>;
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
  const[markupTable,setMarkupTable]=useState(DEFAULT_MARKUP_TABLE);
  const[naturalStoneMarkup,setNaturalStoneMarkup]=useState(DEFAULT_NATURAL_STONE_MARKUP);
  const[labStoneMarkup,setLabStoneMarkup]=useState(DEFAULT_LAB_STONE_MARKUP);
  const[centreRates,setCentreRates]=useState(DEFAULT_CENTRE_RATES);
  const[view,setViewRaw]=useState("dashboard");
  const[selClient,setSelClient]=useState(null);
  const[selJob,setSelJob]=useState(null);
  const[storageReady,setStorageReady]=useState(false);
  const[loadError,setLoadError]=useState(false);
  const[loadNonce,setLoadNonce]=useState(0);
  const[session,setSession]=useState(null);
  const[authReady,setAuthReady]=useState(!supabaseEnabled);
  // Stable across token refreshes — only changes on real sign-in/out
  const userId=session?.user?.id||null;

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

  // Keep the markup threshold buffer (used inside pure calc helpers) in sync with business settings
  useEffect(()=>{setMarkupBuffer(biz?.markupBuffer||0);},[biz?.markupBuffer]);
  useEffect(()=>{setQuoteRounding(biz?.quoteRounding||0);},[biz?.quoteRounding]);

  // Load all persisted data on mount
  useEffect(()=>{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap';
    document.head.appendChild(link);
    return ()=>{try{document.head.removeChild(link);}catch(e){}};
  },[]);

  useEffect(()=>{
    // Wait until we know the auth state. In cloud mode, only load once logged in.
    if(!authReady)return;
    if(supabaseEnabled&&!userId)return;

    const keyToSetter={
      [K.cl]:setClients,[K.jo]:setJobs,[K.qu]:setQuotes,[K.pa]:setPayments,
      [K.pr]:setPricing,[K.biz]:setBiz,[K.no]:setNotes,[K.inv]:setInvoices,
      [K.mt]:setMarkupTable,[K.smn]:setNaturalStoneMarkup,[K.sml]:setLabStoneMarkup,[K.csr]:setCentreRates,
      [K.ap]:setAppointments,[K.pp]:setProposals,
    };
    // Normalise legacy values before applying to state
    const applyLoaded=(k,v,setter)=>{
      if(v===null||v===undefined)return;
      if(k===K.pr&&Array.isArray(v)){
        v=v.map(it=>it&&it.category==="Findings / Components / Purchased Parts"?{...it,category:FINDINGS_CAT}:it);
        const savedIds=new Set(v.map(x=>x.id));
        const missing=SEED_PRICING.filter(x=>!savedIds.has(x.id));
        if(missing.length>0)v=[...v,...missing];
      }
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
      if(cloudMode){
        // Strict load: ALL keys must read from the cloud before we allow any cloud writes.
        // If the cloud can't be reached, we block the app instead of risking an overwrite.
        try{
          const entries=Object.entries(keyToSetter);
          const values=await Promise.all(entries.map(([k])=>_cloudGet(k)));
          entries.forEach(([k,setter],i)=>applyLoaded(k,values[i],setter));
          setCloudLoaded(true);   // ✅ now safe to persist to the cloud
        }catch(e){
          setCloudLoaded(false);
          clearTimeout(giveUp);
          setLoadError(true);
          setStorageReady(true);
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
        .on("postgres_changes",{event:"*",schema:"public",table:STATE_TABLE},(payload)=>{
          const row=payload.new&&Object.keys(payload.new).length?payload.new:null;
          if(!row)return;
          const setter=keyToSetter[row.key];
          if(setter)applyLoaded(row.key,row.value,setter);
        })
        .subscribe();
    }
    return()=>{clearTimeout(giveUp);if(channel&&supabase){try{supabase.removeChannel(channel);}catch(e){}}};
  },[authReady,userId,loadNonce]);

  const setView=useCallback(v=>{
    if(v.startsWith("clientDetail_")){setSelClient(v.split("_")[1]);setViewRaw("clientDetail");}
    else if(v.startsWith("jobDetail_")){setSelJob(v.split("_")[1]);setViewRaw("jobDetail");}
    else setViewRaw(v);
  },[]);

  // ── Proposal + repair response notifications ───────────────────────────
  // Live refs so the realtime callback always sees current data (avoids stale closures).
  const proposalsRef=useRef(proposals);proposalsRef.current=proposals;
  const quotesRef=useRef(quotes);quotesRef.current=quotes;
  const jobsRef=useRef(jobs);jobsRef.current=jobs;
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
    const nq=quotesRef.current.map(q=>{
      if(acceptedIds.includes(q.id))return{...q,status:"Approved"};
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
    const nj=jobsRef.current.map(j=>j.id===job.id?{...j,repairResponse:resp}:j);
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
    if(view==="clientDetail")return "clients";
    return view;
  },[view]);

  const render=()=>{
    if(view==="dashboard")return <Dashboard clients={clients} jobs={jobs} quotes={quotes} payments={payments} invoices={invoices} appointments={appointments} proposals={proposals} markProposalSeen={markProposalSeen} markRepairSeen={markRepairSeen} markupTable={markupTable} setView={setView} setSelClient={setSelClient}/>;
    if(view==="appointments")return <Appointments appointments={appointments} setAppointments={setAppointments} clients={clients} setClients={setClients} jobs={jobs} setJobs={setJobs} setView={setView} setSelClient={setSelClient} setSelJob={setSelJob}/>;
    if(view==="clients")return <Clients clients={clients} setClients={setClients} jobs={jobs} payments={payments} setView={setView} setSelClient={setSelClient}/>;
    if(view==="clientDetail")return <ClientDetail clientId={selClient} clients={clients} setClients={setClients} jobs={jobs} setJobs={setJobs} quotes={quotes} payments={payments} markupTable={markupTable} setView={setView} setSelJob={setSelJob}/>;
    if(view==="jobs")return <Jobs clients={clients} jobs={jobs} setJobs={setJobs} quotes={quotes} setQuotes={setQuotes} payments={payments} setPayments={setPayments} notes={notes} setNotes={setNotes} invoices={invoices} setInvoices={setInvoices} markupTable={markupTable} setView={setView} setSelJob={setSelJob}/>;
    if(view==="jobDetail")return <JobDetail jobId={selJob} jobs={jobs} setJobs={setJobs} clients={clients} quotes={quotes} setQuotes={setQuotes} payments={payments} setPayments={setPayments} notes={notes} setNotes={setNotes} invoices={invoices} setInvoices={setInvoices} proposals={proposals} setProposals={setProposals} biz={biz} markupTable={markupTable} setView={setView}/>;
    if(view==="quotes")return <QuotesList quotes={quotes} jobs={jobs} clients={clients} markupTable={markupTable} biz={biz} setView={setView}/>;
    if(view.startsWith("quoteDetail_"))return <QuoteDetail quoteId={view.split("_")[1]} quotes={quotes} setQuotes={setQuotes} jobs={jobs} clients={clients} biz={biz} markupTable={markupTable} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup} payments={payments} setView={setView}/>;
    if(view.startsWith("newQuote_"))return <QuoteBuilder jobId={view.split("_")[1]} jobs={jobs} clients={clients} quotes={quotes} setQuotes={setQuotes} pricing={pricing} setPricing={setPricing} markupTable={markupTable} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup} centreRates={centreRates} setView={setView}/>;
    if(view.startsWith("editQuote_"))return <QuoteBuilder editQuoteId={view.split("_")[1]} jobs={jobs} clients={clients} quotes={quotes} setQuotes={setQuotes} pricing={pricing} setPricing={setPricing} markupTable={markupTable} naturalStoneMarkup={naturalStoneMarkup} labStoneMarkup={labStoneMarkup} centreRates={centreRates} setView={setView}/>;
    if(view==="invoices")return <InvoicesList invoices={invoices} jobs={jobs} clients={clients} quotes={quotes} payments={payments} setInvoices={setInvoices} markupTable={markupTable} setView={setView}/>;
    if(view.startsWith("invoiceDetail_"))return <InvoiceDetail invoiceId={view.split("_")[1]} invoices={invoices} setInvoices={setInvoices} jobs={jobs} clients={clients} payments={payments} biz={biz} setView={setView}/>;
    if(view==="pricing")return <PricingDB pricing={pricing} setPricing={setPricing} spotPrices={spotPrices} setSpotPrices={setSpotPrices} markupTable={markupTable} centreRates={centreRates} setCentreRates={setCentreRates}/>;
    if(view==="reports")return <Reports jobs={jobs} clients={clients} quotes={quotes} payments={payments} invoices={invoices} markupTable={markupTable}/>;
    if(view==="settings")return <Settings biz={biz} setBiz={setBiz} markupTable={markupTable} setMarkupTable={setMarkupTable} naturalStoneMarkup={naturalStoneMarkup} setNaturalStoneMarkup={setNaturalStoneMarkup} labStoneMarkup={labStoneMarkup} setLabStoneMarkup={setLabStoneMarkup}/>;
    return null;
  };

  // Auth gate — only when Supabase is configured (cloud mode)
  if(supabaseEnabled){
    if(!authReady)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CREAM,fontFamily:"'DM Sans',sans-serif",color:WG,fontSize:14}}>Loading…</div>;
    if(!session)return <Login/>;
    // Cloud load failed — block the app so stale/seed data can't be saved over good cloud data
    if(loadError)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CREAM,fontFamily:"'DM Sans',sans-serif",padding:20}}>
      <div style={{maxWidth:420,textAlign:"center",background:WHITE,border:`1px solid ${BD}`,borderRadius:RADIUS,padding:"32px 30px",boxShadow:SHADOW}}>
        <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:17,fontWeight:800,color:INK,marginBottom:8}}>Couldn't load your data</div>
        <div style={{fontSize:13,color:WG,lineHeight:1.6,marginBottom:22}}>We couldn't reach the cloud, so the app is paused to protect your saved data from being overwritten. Check your connection and try again.</div>
        <Btn onClick={()=>{setLoadError(false);setStorageReady(false);setLoadNonce(n=>n+1);}}>Retry</Btn>
      </div>
    </div>;
  }

  return <div style={{display:"flex",minHeight:"100vh",background:CREAM,fontFamily:"'DM Sans',sans-serif"}}>
    <div style={{width:210,background:"#000000",display:"flex",flexDirection:"column",padding:"28px 0",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
      <div style={{padding:"0 20px 28px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{fontSize:8,fontWeight:700,color:GOLD,letterSpacing:"0.28em",textTransform:"uppercase",marginBottom:10,opacity:0.8}}>Studio Platform</div>
        {biz.logo
          ?<div style={{background:WHITE,borderRadius:10,padding:"8px 12px",display:"inline-flex",maxWidth:"100%"}}>
              <img src={biz.logo} alt={biz.name||"Logo"} style={{maxWidth:"100%",maxHeight:46,objectFit:"contain",display:"block"}}/>
            </div>
          :<div style={{fontSize:24,fontWeight:300,color:WHITE,letterSpacing:"0.18em",fontFamily:"'DM Sans',sans-serif",lineHeight:1.1}}>{biz.name||"VAHÉ"}</div>}
      </div>
      <nav style={{padding:"16px 8px",flex:1}}>
        {NAV.map(n=>{
          const active=activeNav===n.id;
          return <button key={n.id} onClick={()=>setView(n.id)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 16px",borderRadius:0,border:"none",borderLeft:active?`2px solid ${GOLD}`:"2px solid transparent",background:active?"rgba(184,146,42,0.1)":"transparent",color:active?GOLD:"rgba(255,255,255,0.45)",fontSize:11,fontWeight:active?700:400,cursor:"pointer",fontFamily:"inherit",textAlign:"left",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2,transition:"all 0.12s"}}
            onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color=WHITE;}}}
            onMouseLeave={e=>{e.currentTarget.style.background=active?"rgba(201,168,76,0.16)":"transparent";e.currentTarget.style.color=active?GOLD:"rgba(255,255,255,0.42)";}}>
            <span style={{fontSize:14}}>{n.icon}</span>{n.label}
          </button>;
        })}
      </nav>
      <div style={{padding:"12px 20px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
        {supabaseEnabled&&session&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:6,wordBreak:"break-all"}}>{session.user?.email}</div>
          <button onClick={()=>supabase.auth.signOut()} style={{background:"none",border:"1px solid rgba(255,255,255,0.18)",borderRadius:6,padding:"5px 12px",color:"rgba(255,255,255,0.55)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.04em"}}>Sign out</button>
        </div>}
        <div style={{fontSize:9,color:"rgba(255,255,255,0.18)",letterSpacing:"0.1em",textTransform:"uppercase"}}>v0.9</div>
      </div>
    </div>
    <div style={{flex:1,padding:"40px 56px",width:"100%",minWidth:0}}>
      {!storageReady
        ?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300,flexDirection:"column",gap:12}}>
            <div style={{fontSize:13,color:WG}}>Loading your data…</div>
          </div>
        :render()}
    </div>
    {/* Live response pop-up — proposals & repairs (any view) */}
    {acceptToast&&<div onClick={()=>{const j=acceptToast.jobId;setAcceptToast(null);if(j)setView("jobDetail_"+j);}}
      style={{position:"fixed",bottom:24,right:24,maxWidth:340,background:INK,color:WHITE,borderRadius:12,padding:"16px 18px",boxShadow:"0 12px 40px rgba(0,0,0,0.35)",zIndex:9999,cursor:"pointer",border:`1px solid ${(acceptToast.color||OK)}66`}}>
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
