/* Swap decorative sprites only. Preserve all real gameplay and multiplayer handlers. */
(()=>{
'use strict';
const crest=document.getElementById('gothicCenterCrest');
if(crest)crest.src='./assets/ui-gothic/reference-v2/central-crest-v2.webp';
const actions=document.getElementById('gothicPreviewActions');
if(actions)actions.setAttribute('aria-label','Priest commands: Basic Attack, Place Ward, End Turn, Menu');
})();
