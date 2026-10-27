var g=window.LitElement||window.customElements.get("ha-card")?.constructor?.superclass;if(!g)try{g=customElements.get("ha-card").constructor}catch{console.error("LitElement not found, trying fallback...")}var u={"under-transpiration":{max:.4,label:"Unter-Transpiration",color:"#ff0000"},"early-veg":{min:.4,max:.8,label:"Frühe Vegetationsphase",color:"#ffa500"},"late-veg":{min:.8,max:1.2,label:"Späte Vegetationsphase",color:"#ffff00"},"mid-late-flower":{min:1.2,max:1.6,label:"Mittlere bis späte Blüte",color:"#00ff00"},"danger-zone":{min:1.6,label:"Gefahrenzone",color:"#ff00ff"}},v={0:"rotate(0deg)",90:"rotate(90deg)",180:"rotate(180deg)",270:"rotate(270deg)"},c=["soil_temperature","soil_moisture","soil_illuminance","soil_conductivity"],_=3,m={soil_temperature:{label:"Bodentemperatur",unit:"°C",icon:"🌡️"},soil_moisture:{label:"Bodenfeuchtigkeit",unit:"%",icon:"💧"},soil_illuminance:{label:"Bodenbeleuchtung",unit:"lux",icon:"☀️"},soil_conductivity:{label:"Bodenleitfähigkeit",unit:"mS/cm",icon:"⚡"}},d="alle";var f=class extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this._config={},this._entityStates={},this._historyData={},this._growthPhase="off",this._targetProfile={},this._cameraImage="",this._activeGrowRun="",this._plants=[],this._diaryContent="",this._showEntryForm=!1,this._entryFormData={note:"",plant_tag:d,event_title:"",date:this._formatDateForInput(new Date)},this._hass={}}set hass(e){this._hass=e,this._loadConfigFromHass(),this._loadEntityStates(),this._render()}connectedCallback(){this._loadConfig(),this._loadEntityStates(),this._setupHassConnection(),this._render(),this._setupEventListeners()}disconnectedCallback(){this._cleanupHassConnection(),this._cleanupEventListeners()}attributeChangedCallback(e,t,r){this._render()}_setupEventListeners(){window.growhelperPanel=this;var e=this.shadowRoot;e&&(this._boundHandleFormChange=this._handleFormChange.bind(this),this._boundHandleClick=this._handleClick.bind(this),e.addEventListener("change",this._boundHandleFormChange),e.addEventListener("click",this._boundHandleClick))}_cleanupEventListeners(){window.growhelperPanel===this&&delete window.growhelperPanel;var e=this.shadowRoot;e&&this._boundHandleFormChange&&this._boundHandleClick&&(e.removeEventListener("change",this._boundHandleFormChange),e.removeEventListener("click",this._boundHandleClick),this._boundHandleFormChange=null,this._boundHandleClick=null)}_handleFormChange(e){var t=e.target,r=null,a=t.value;t.classList.contains("diary-input")&&(r=t.getAttribute("data-field")),r&&(this._updateFormField(r,a),this._render())}_handleClick(e){for(var t=e.target;t&&t!==this.shadowRoot;){if(t.classList.contains("btn-primary")||t.classList.contains("btn-secondary")){var r=t.getAttribute("data-action");if(r){this._handleButtonAction(r),e.preventDefault(),e.stopPropagation();return}}t=t.parentElement}}_handleButtonAction(e){switch(e){case"toggle-entry-form":this._toggleEntryForm();break;case"submit-entry":this._submitDiaryEntry();break;case"start-new-run":this._startNewGrowRun();break}}_loadConfig(){this._hass&&this._hass.states&&this._loadConfigFromHass()}_loadConfigFromHass(){if(!(!this._hass||!this._hass.states)){var e=null;for(var t in this._hass.states)if(t.startsWith("sensor.growhelper_config")||t.startsWith("growhelper.config")){e=this._hass.states[t];break}e&&e.attributes?this._config=e.attributes:this._config={},this._config&&(this._loadTargetProfile(),this._loadActiveGrowRun(),this._loadPlants(),this._loadDiaryContent())}}_loadTargetProfile(){var e=this._growthPhase||this._config.growth_phase||"early-veg";this._targetProfile={temperature:{lower:this._config[e+"_temperature_lower"]||20,upper:this._config[e+"_temperature_upper"]||28},humidity:{lower:this._config[e+"_humidity_lower"]||40,upper:this._config[e+"_humidity_upper"]||70},vpd:{lower:this._config[e+"_vpd_lower"]||.4,upper:this._config[e+"_vpd_upper"]||1.2},light:{on:this._config[e+"_light_on_time"]||"08:00",off:this._config[e+"_light_off_time"]||"20:00"}}}_loadActiveGrowRun(){this._activeGrowRun=this._config.active_grow_run||""}_loadPlants(){this._plants=[];for(var e=1;e<=_;e++){var t="plant_"+e,r=this._config[t+"_name"];if(r&&r.trim()){for(var a={name:r,cultivar:this._config[t+"_cultivar"]||"",sensors:{}},i=0;i<c.length;i++){var o=c[i],n=this._config[t+"_"+o];a.sensors[o]=n||null}this._plants.push(a)}}}_loadDiaryContent(){if(!this._activeGrowRun){this._diaryContent="";return}this._diaryContent=this._getSampleDiaryContent()}_getSampleDiaryContent(){return`## 10.10.2026

#### Bewässerung

- [alle] Pflanzen bewässert

---

## 11.10.2026

#### Düngung

- [Pflanze 1] Dünger hinzugefügt

---
`}_formatDateForInput(e){e||(e=new Date);var t=e.getFullYear(),r=String(e.getMonth()+1).padStart(2,"0"),a=String(e.getDate()).padStart(2,"0");return t+"-"+r+"-"+a}_formatDateForDisplay(e){if(!e)return"";var t=new Date(e),r=String(t.getDate()).padStart(2,"0"),a=String(t.getMonth()+1).padStart(2,"0"),i=t.getFullYear();return r+"."+a+"."+i}_getPlantTagOptions(){for(var e=[{value:d,label:"Alle Pflanzen"}],t=0;t<this._plants.length;t++){var r=this._plants[t];e.push({value:r.name,label:r.name})}return e}_toggleEntryForm(){this._showEntryForm=!this._showEntryForm,this._showEntryForm||(this._entryFormData={note:"",plant_tag:d,event_title:"",date:this._formatDateForInput(new Date)}),this._render()}_updateFormField(e,t){this._entryFormData[e]=t}_submitDiaryEntry(){if(this._entryFormData.note.trim()){console.log("Submitting diary entry:",this._entryFormData);var e=this._formatDiaryEntry(this._entryFormData);this._callHassService("growhelper","add_diary_entry",{note:this._entryFormData.note,plant_tag:this._entryFormData.plant_tag===d?"all":this._entryFormData.plant_tag,event_title:this._entryFormData.event_title||void 0,date:this._entryFormData.date||void 0}),this._entryFormData={note:"",plant_tag:d,event_title:"",date:this._formatDateForInput(new Date)},this._showEntryForm=!1,this._diaryContent?this._diaryContent+=`
`+e:this._diaryContent=e,this._render()}}_formatDiaryEntry(e){var t=new Date(e.date),r=this._formatDateForDisplay(e.date),a="## "+r,i=a+`

`;return e.event_title&&(i+="#### "+e.event_title+`

`),i+="- ["+e.plant_tag+"] "+e.note+`
`,i+=`---
`,i}_startNewGrowRun(){console.log("Starting new grow run"),this._callHassService("growhelper","start_grow_run",{});var e="grow_run_"+new Date().toISOString().substr(0,10).replace(/-/g,"");this._activeGrowRun=e,this._diaryContent=this._getSampleDiaryContent(),this._growthPhase="early-veg",this._render()}_callHassService(e,t,r){if(this._hass&&this._hass.callService)try{this._hass.callService(e,t,r)}catch(a){console.error("Error calling service:",e,t,a)}else console.log("Service call (simulated):",e,t,r)}_renderPlantsSection(){if(!this._plants||this._plants.length===0)return'<p class="empty">Keine Pflanzen konfiguriert.</p>';for(var e='<div class="plants-grid">',t=0;t<this._plants.length;t++){var r=this._plants[t],a="plant-"+(t+1);e+='<div class="plant-card" data-plant-id="'+a+'"><div class="plant-header"><span class="plant-name">'+this._escapeHtml(r.name)+"</span>",r.cultivar&&(e+='<span class="plant-cultivar">'+this._escapeHtml(r.cultivar)+"</span>"),e+='</div><div class="plant-sensors">';for(var i=0;i<c.length;i++){var o=c[i],n=m[o],l=r.sensors[o],s=null,h=null;l&&(h=this._getEntityState(l),h&&(s=h.state));var p=l&&s!==null&&s!==void 0&&s!=="unavailable"&&s!=="unknown";e+='<div class="plant-sensor-card '+(p?"has-value":"empty")+'"><div class="sensor-icon">'+n.icon+'</div><div class="sensor-label">'+n.label+'</div><div class="sensor-value">',p?e+=this._formatNumber(s,1)+' <span class="sensor-unit">'+n.unit+"</span>":e+='<span class="sensor-unavailable">––</span>',e+='</div><div class="sensor-chart"><div class="chart-placeholder">'+n.label+"-Verlauf (24h)</div></div></div>"}e+="</div></div>"}return e+="</div>",e}_escapeHtml(e){if(!e)return"";var t=document.createElement("div");return t.textContent=e,t.innerHTML}_renderDiarySection(){var e="";return this._activeGrowRun?e+='<div class="diary-header"><span class="active-run-info"><strong>Aktive Grow Run:</strong> '+this._escapeHtml(this._activeGrowRun)+'</span><button class="btn btn-primary" data-action="start-new-run">🆕 Neue Grow Run starten</button></div>':e+='<div class="diary-header"><p class="empty">Keine aktive Grow Run. Starte eine neue, um Einträge hinzuzufügen.</p><button class="btn btn-primary" data-action="start-new-run">🆕 Neue Grow Run starten</button></div>',this._diaryContent?e+='<div class="diary-content markdown-body">'+this._renderMarkdown(this._diaryContent)+"</div>":this._activeGrowRun&&(e+='<div class="diary-content empty"><p>Keine Einträge für diese Grow Run.</p></div>'),e+='<div class="diary-entry-form"><button class="btn btn-secondary" data-action="toggle-entry-form">'+(this._showEntryForm?"❌ Abbrechen":"➕ Neuer Eintrag")+"</button>"+(this._showEntryForm?this._renderEntryForm():"")+"</div>",e}_renderEntryForm(){for(var e=this._getPlantTagOptions(),t="",r=0;r<e.length;r++){var a=e[r],i=a.value===this._entryFormData.plant_tag?"selected":"";t+='<option value="'+this._escapeHtml(a.value)+'" '+i+">"+this._escapeHtml(a.label)+"</option>"}return'<div class="entry-form-container"><div class="form-group"><label>Datum:</label><input type="date" class="diary-input" data-field="date" value="'+this._entryFormData.date+'"></div><div class="form-group"><label>Ereignis (optional):</label><input type="text" class="diary-input" data-field="event_title" value="'+this._escapeHtml(this._entryFormData.event_title)+'" placeholder="z.B. Bewässerung, Düngung"></div><div class="form-group"><label>Pflanze:</label><select class="diary-input" data-field="plant_tag">'+t+'</select></div><div class="form-group"><label>Notiz:</label><textarea class="diary-input" data-field="note" placeholder="Was ist passiert?" rows="3">'+this._escapeHtml(this._entryFormData.note)+'</textarea></div><div class="form-actions"><button class="btn btn-primary" data-action="submit-entry">✅ Eintrag hinzufügen</button></div></div>'}_renderMarkdown(e){if(!e)return'<p class="empty">Kein Inhalt</p>';var t=this._escapeHtml(e);t=t.replace(/^##\s+(.+)$/gm,"<h3>$1</h3>"),t=t.replace(/^####\s+(.+)$/gm,"<h4>$1</h4>"),t=t.replace(/^---$/gm,"<hr>"),t=t.replace(/^-\s+\[([^\]]+)\]\s+(.+)$/gm,"<li><strong>[$1]</strong> $2</li>");var r=t.includes("<li>");return r&&(t=t.replace(/<li>/g,"<li>").replace(/<\/li>/g,"</li>"),t=t.replace(/((?:<li>.*?<\/li>\s*)+)/g,"<ul>$1</ul>")),t=t.replace(/<ul><\/ul>/g,""),t=t.replace(/^([^<].+)$/gm,"<p>$1</p>"),t}_loadEntityStates(){!this._hass||!this._hass.states||(this._entityStates={},Object.keys(this._hass.states).forEach(function(e){this._entityStates[e]=this._hass.states[e]}.bind(this)),this._loadCameraImage())}_setupHassConnection(){}_cleanupHassConnection(){}_handleStateChange(){this._loadEntityStates(),this._render()}_handleConfigChange(){this._loadConfigFromHass(),this._render()}_loadCameraImage(){if(this._config.camera){var e=this._entityStates[this._config.camera];e&&e.attributes&&e.attributes.entity_picture?this._cameraImage=e.attributes.entity_picture:this._cameraImage=""}}_getEntityState(e){return this._entityStates[e]}_getEntityValue(e){var t=this._getEntityState(e);return t?t.state:null}_getEntityAttribute(e,t){var r=this._getEntityState(e);return r?r.attributes&&r.attributes[t]:null}_getGrowthPhase(){for(var e=["early-veg","late-veg","late-bloom","dry","off"],t=0;t<e.length;t++){var r=e[t],a="growth_phase_"+r.replace(/-/g,"_"),i=this._config[a];if(i&&this._getEntityValue(i)==="on")return r}return"off"}_getCameraRotationStyle(){var e=this._config.camera_rotation||"0";return v[e]||"rotate(0deg)"}_isInRange(e,t,r){return e==null||t===null||r===null?null:e>=t&&e<=r}_safeParseFloat(e){if(e==null||e==="unavailable"||e==="unknown")return null;var t=parseFloat(e);return isNaN(t)?null:t}_formatNumber(e,t){if(e==null)return"--";var r=this._safeParseFloat(e);return r===null?"--":r.toFixed(t||1)}_getGrowthPhaseLabel(){var e={"early-veg":"Frühe Vegetationsphase","late-veg":"Späte Vegetationsphase","late-bloom":"Späte Blüte",dry:"Trocknung",off:"Aus"};return e[this._growthPhase]||e.off}_renderCameraSection(e){if(!e)return'<p class="empty">Keine Kamera konfiguriert oder verfügbar.</p>';var t=this._config.camera_rotation||"0";return`<div class="camera-container">
      <img src="${this._escapeHtml(this._cameraImage)}" style="transform: ${this._getCameraRotationStyle()};">
      <div class="camera-rotation-info">Rotation: ${this._escapeHtml(t)}°</div>
    </div>`}_renderThresholdIndicator(e,t){var r=this._safeParseFloat(e),a=this._isInRange(r,t.lower,t.upper);return a===!0?'<span class="threshold-indicator in-range" title="Im Zielbereich"></span>':a===!1&&r<t.lower?'<span class="threshold-indicator below-range" title="Unter dem Zielbereich"></span>':a===!1?'<span class="threshold-indicator above-range" title="Über dem Zielbereich"></span>':""}_renderEnvironmentReading(e,t,r,a,i){return`<div class="env-card">
      <div class="label">${e}</div>
      <div class="value">
        ${this._formatNumber(t,1)}
        <span class="unit">${r}</span>
        ${this._renderThresholdIndicator(t,a)}
      </div>
      <div class="chart-container"><div class="chart-placeholder">${i} (24h)</div></div>
    </div>`}_renderEnvironmentSection(e,t,r){return!e&&!t?'<p class="empty">Keine Umgebungs-Sensoren konfiguriert oder verfügbar.</p>':`<div class="environment-grid">
      ${e?this._renderEnvironmentReading("Temperatur",r.temperature,"°C",this._targetProfile.temperature,"Temperaturverlauf"):""}
      ${t?this._renderEnvironmentReading("Luftfeuchtigkeit",r.humidity,"%",this._targetProfile.humidity,"Luftfeuchtigkeitsverlauf"):""}
    </div>`}_renderVpdSection(e,t){if(!e)return'<p class="empty">Kein VPD-Sensor konfiguriert oder verfügbar.</p>';var r=this._safeParseFloat(t),a=this._isInRange(r,this._targetProfile.vpd.lower,this._targetProfile.vpd.upper),i=Object.keys(u).map(o=>{var n=u[o],l=r!==null&&(n.min===void 0?r<n.max:n.max===void 0?r>=n.min:r>=n.min&&r<=n.max),s=n.min===void 0?`&lt; ${n.max} kPa`:n.max===void 0?`&gt; ${n.min} kPa`:`${n.min}–${n.max} kPa`;return`<div class="vpd-zone">
        <div class="vpd-zone-color" style="background: ${n.color};"></div>
        <div class="vpd-zone-label">${n.label}</div>
        <div class="vpd-zone-range">${s}</div>
        ${l?`<div class="vpd-current-indicator" style="background: ${n.color};"></div>`:""}
      </div>`}).join("");return`<div class="vpd-container">
      <div class="vpd-value-display">
        <div class="vpd-value">${this._formatNumber(t,2)}</div>
        <div class="vpd-unit">kPa</div>
        <div class="status-badge ${a===!0?"active":"inactive"}">
          ${a===!0?"Im Zielbereich":"Außerhalb des Zielbereichs"}
        </div>
      </div>
      <div class="vpd-zones">${i}</div>
    </div>
    <div class="chart-container"><div class="chart-placeholder">VPD-Verlauf (24h)</div></div>`}_renderDeviceCard(e,t,r,a){var i=r==="on",o=a==null||a===""?"":`<div class="device-power">${this._escapeHtml(a)} W</div>`;return`<div class="device-card">
      <div class="device-icon">${e}</div>
      <div class="device-name">${t}</div>
      <div class="device-state ${i?"on":"off"}">${i?"EIN":"AUS"}</div>
      ${o}
    </div>`}_renderClimateSection(e,t){var r=[["humidifier","💦","Befeuchter","humidifier_power"],["dehumidifier","🌬️","Entfeuchter","dehumidifier_power"],["exhaust_fan","💨","Abluft","exhaust_fan_power"],["ventilation_fan","🌀","Belüftung","ventilation_fan_power"]].filter(([a])=>e[a]);return r.length===0?'<p class="empty">Keine Klima-Geräte konfiguriert oder verfügbar.</p>':`<div class="devices-grid">${r.map(([a,i,o,n])=>this._renderDeviceCard(i,o,t[a],t[n])).join("")}</div>`}_renderLightSection(e,t){if(!e.grow_light)return'<p class="empty">Keine Licht-Steuerung konfiguriert oder verfügbar.</p>';var r=t.grow_light==="on",a=this._targetProfile.light?.on||"08:00",i=this._targetProfile.light?.off||"20:00",o=t.grow_light_power===null||t.grow_light_power===void 0?"":`<div style="margin-top: 8px; font-size: 14px; color: var(--secondary-text-color, #727272);">
        Leistung: ${this._escapeHtml(t.grow_light_power)} W
      </div>`;return`<div class="light-schedule">
      <div class="light-time"><span class="light-time-icon">🌅</span><span class="light-time-value">${this._escapeHtml(a)}</span></div>
      <div class="light-time"><span class="light-time-icon">🌇</span><span class="light-time-value">${this._escapeHtml(i)}</span></div>
      <div class="light-state ${r?"on":"off"}">${r?"EINGESCHALTET":"AUSGESCHALTET"}</div>
    </div>${o}`}_render(){this._growthPhase=this._getGrowthPhase();var e={canopy_temperature:this._config.canopy_temperature,canopy_humidity:this._config.canopy_humidity,vpd_sensor:this._config.vpd_sensor,camera:this._config.camera,humidifier:this._config.humidifier,dehumidifier:this._config.dehumidifier,exhaust_fan:this._config.exhaust_fan,ventilation_fan:this._config.ventilation_fan,grow_light:this._config.grow_light,humidifier_power:this._config.humidifier_power,dehumidifier_power:this._config.dehumidifier_power,exhaust_fan_power:this._config.exhaust_fan_power,ventilation_fan_power:this._config.ventilation_fan_power,grow_light_power:this._config.grow_light_power},t={temperature:this._getEntityValue(e.canopy_temperature),humidity:this._getEntityValue(e.canopy_humidity),vpd:this._getEntityValue(e.vpd_sensor),humidifier:this._getEntityValue(e.humidifier),dehumidifier:this._getEntityValue(e.dehumidifier),exhaust_fan:this._getEntityValue(e.exhaust_fan),ventilation_fan:this._getEntityValue(e.ventilation_fan),grow_light:this._getEntityValue(e.grow_light),humidifier_power:this._getEntityValue(e.humidifier_power),dehumidifier_power:this._getEntityValue(e.dehumidifier_power),exhaust_fan_power:this._getEntityValue(e.exhaust_fan_power),ventilation_fan_power:this._getEntityValue(e.ventilation_fan_power),grow_light_power:this._getEntityValue(e.grow_light_power)},r=e.camera&&this._cameraImage,a=e.canopy_temperature&&t.temperature!==null,i=e.canopy_humidity&&t.humidity!==null,o=e.vpd_sensor&&t.vpd!==null,n=`<style>
        :host {
          display: block;
          padding: 16px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: var(--ha-font-family, sans-serif);
        }

        h1 {
          font-size: 24px;
          margin: 0 0 16px;
          color: var(--primary-text-color, #212121);
        }

        section {
          margin-bottom: 24px;
          background: var(--card-background-color, #ffffff);
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        h2 {
          font-size: 18px;
          margin: 0;
          padding: 16px 16px 8px;
          color: var(--primary-text-color, #212121);
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }

        .card {
          padding: 16px;
        }

        .empty {
          color: var(--secondary-text-color, #727272);
          font-style: italic;
          padding: 8px 0;
        }

        /* Growth Phase */
        .growth-phase {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: var(--primary-color, #03A9F4);
          color: white;
          border-radius: 12px;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 16px;
        }

        /* Camera Section */
        .camera-container {
          position: relative;
          overflow: hidden;
          border-radius: 4px;
        }

        .camera-container img {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.3s ease;
        }

        .camera-rotation-info {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-top: 4px;
        }

        /* Environment Section */
        .environment-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .env-card {
          background: var(--secondary-background-color, #f5f5f5);
          padding: 12px;
          border-radius: 4px;
        }

        .env-card .label {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
        }

        .env-card .value {
          font-size: 20px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }

        .env-card .unit {
          font-size: 14px;
          color: var(--secondary-text-color, #727272);
          margin-left: 4px;
        }

        .threshold-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-left: 8px;
        }

        .threshold-indicator.in-range {
          background-color: #4CAF50;
        }

        .threshold-indicator.below-range {
          background-color: #FF9800;
        }

        .threshold-indicator.above-range {
          background-color: #F44336;
        }

        .chart-container {
          height: 100px;
          margin-top: 8px;
        }

        .chart-placeholder {
          height: 100%;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--secondary-text-color, #727272);
          font-size: 12px;
        }

        /* VPD Section */
        .vpd-container {
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }

        .vpd-value-display {
          flex: 0 0 200px;
        }

        .vpd-value {
          font-size: 32px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }

        .vpd-unit {
          font-size: 16px;
          color: var(--secondary-text-color, #727272);
        }

        .vpd-zones {
          flex: 1;
        }

        .vpd-zone {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }

        .vpd-zone-color {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          margin-right: 8px;
        }

        .vpd-zone-label {
          flex: 1;
          font-size: 14px;
        }

        .vpd-zone-range {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
        }

        .vpd-current-indicator {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 0 2px currentColor;
          margin-right: 4px;
        }

        /* Plants Section */
        .plants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .plant-card {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 8px;
          padding: 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
        }

        .plant-header {
          display: flex;
          flex-direction: column;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }

        .plant-name {
          font-size: 16px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }

        .plant-cultivar {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          font-style: italic;
        }

        .plant-sensors {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .plant-sensor-card {
          background: white;
          border-radius: 4px;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
        }

        .plant-sensor-card.has-value {
          background: white;
        }

        .plant-sensor-card.empty {
          background: var(--secondary-background-color, #f5f5f5);
        }

        .sensor-icon {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .sensor-label {
          font-size: 11px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sensor-value {
          font-size: 14px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }

        .sensor-unit {
          font-size: 11px;
          color: var(--secondary-text-color, #727272);
        }

        .sensor-unavailable {
          color: var(--secondary-text-color, #727272);
          font-style: italic;
        }

        .sensor-chart {
          height: 60px;
          margin-top: 6px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 8px;
          font-size: 12px;
          margin-top: 8px;
        }

        .status-badge.active {
          background: #4CAF50;
          color: white;
        }

        .status-badge.inactive {
          background: #9E9E9E;
          color: white;
        }

        /* Climate Devices Section */
        .devices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .device-card {
          background: var(--secondary-background-color, #f5f5f5);
          padding: 12px;
          border-radius: 4px;
          text-align: center;
        }

        .device-icon {
          font-size: 24px;
          margin-bottom: 4px;
        }

        .device-name {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
        }

        .device-state {
          font-size: 14px;
          font-weight: bold;
        }

        .device-state.on {
          color: #4CAF50;
        }

        .device-state.off {
          color: #F44336;
        }

        .device-power {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-top: 4px;
        }

        /* Light Schedule Section */
        .light-schedule {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .light-time {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .light-time-icon {
          font-size: 16px;
        }

        .light-time-value {
          font-size: 14px;
          font-weight: bold;
        }

        .light-state {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }

        .light-state.on {
          background: #4CAF50;
          color: white;
        }

        .light-state.off {
          background: #F44336;
          color: white;
        }

        /* Responsive */
        @media (max-width: 600px) {
          :host {
            padding: 8px;
          }

          h1 {
            font-size: 20px;
          }

          .vpd-container {
            flex-direction: column;
          }

          .vpd-value-display {
            flex: none;
            text-align: center;
          }

          .plants-grid {
            grid-template-columns: 1fr;
          }

          .plant-sensors {
            grid-template-columns: 1fr;
          }

          .diary-header {
            flex-direction: column;
            align-items: stretch;
          }

          .form-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }

        /* Diary Section */
        .diary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .active-run-info {
          font-size: 14px;
          color: var(--secondary-text-color, #727272);
        }

        .diary-content {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
          min-height: 100px;
        }

        .diary-content.empty {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--secondary-text-color, #727272);
          font-style: italic;
        }

        .markdown-body {
          line-height: 1.5;
        }

        .markdown-body h3 {
          font-size: 16px;
          margin: 16px 0 8px;
          color: var(--primary-text-color, #212121);
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          padding-bottom: 4px;
        }

        .markdown-body h4 {
          font-size: 14px;
          margin: 12px 0 4px;
          color: var(--primary-text-color, #212121);
        }

        .markdown-body p {
          margin: 8px 0;
          color: var(--primary-text-color, #212121);
        }

        .markdown-body ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .markdown-body li {
          margin: 4px 0;
          color: var(--primary-text-color, #212121);
        }

        .markdown-body hr {
          border: none;
          border-top: 1px solid var(--divider-color, #e0e0e0);
          margin: 12px 0;
        }

        .diary-entry-form {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }

        .entry-form-container {
          margin-top: 12px;
          padding: 12px;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
        }

        .form-group {
          margin-bottom: 12px;
        }

        .form-group label {
          display: block;
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
          font-weight: bold;
        }

        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }

        /* Buttons */
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .btn-primary {
          background: var(--primary-color, #03A9F4);
          color: white;
        }

        .btn-primary:hover {
          background: var(--primary-color-dark, #0288D1);
        }

        .btn-secondary {
          background: var(--secondary-background-color, #f5f5f5);
          color: var(--primary-text-color, #212121);
          border: 1px solid var(--divider-color, #e0e0e0);
        }

        .btn-secondary:hover {
          background: var(--divider-color, #e0e0e0);
        }
      </style>

      <h1>Growhelper</h1>

      <!-- Growth Phase Indicator -->
      <div class="growth-phase">
        <span>🌱</span>
        <span>${this._getGrowthPhaseLabel()}</span>
      </div>

      <!-- Camera Section -->
      <section data-section="camera">
        <h2>📹 Kamera</h2>
        <div class="card">${this._renderCameraSection(r)}</div>
      </section>

      <!-- Environment Section -->
      <section data-section="environment">
        <h2>🌡️ Umgebung</h2>
        <div class="card">${this._renderEnvironmentSection(a,i,t)}</div>
      </section>

      <!-- VPD Section -->
      <section data-section="vpd">
        <h2>💧 VPD (Dampfdruckdefizit)</h2>
        <div class="card">${this._renderVpdSection(o,t.vpd)}</div>
      </section>

      <!-- Climate Section -->
      <section data-section="climate">
        <h2>🌬️ Klima-Geräte</h2>
        <div class="card">${this._renderClimateSection(e,t)}</div>
      </section>

      <!-- Light Schedule Section -->
      <section data-section="light">
        <h2>💡 Licht-Steuerung</h2>
        <div class="card">${this._renderLightSection(e,t)}</div>
      </section>

      <!-- Plants Section (Issue #9) -->
      <section data-section="plants">
        <h2>🌱 Pflanzen</h2>
        <div class="card">${this._renderPlantsSection()}</div>
      </section>

      <!-- Diary Section (Issue #10) -->
      <section data-section="diary">
        <h2>📖 Tagebuch</h2>
        <div class="card">${this._renderDiarySection()}</div>
      </section>
    `;this.shadowRoot.innerHTML=n}};customElements.define("growhelper-panel",f);
