// Prepare a local review with directory drafts and private practice access.
// Existing records are preserved. This never creates example events or sends mail.
import {call} from './seed-associations.mjs';
const {associations}=await call('/associations');
let association=associations.find(a=>a.name==='Eksempelforeningen Solsiden');
if(!association)association=(await call('/admin/associations',{requestKey:'b5c89a12-a7b7-4ad4-b7a5-e3f51605c4cc',association:{name:'Eksempelforeningen Solsiden',category:'Lokal afprøvning',description:'Opdigtet øveforening til login og administration. Ingen af oplysningerne beskriver en rigtig forening.',place:'Lokalt øveområde'}})).association;
const {members}=await call('/associations/'+association.id+'/members');
for(const [email,name]of [['ansvarlig@example.test','Øveperson'],['redaktor@example.test','Anden øveperson']]){
 if(!members.some(m=>m.email===email&&['active','invited'].includes(m.status)))await call('/admin/associations/'+association.id+'/members',{email,name});
}
console.log('Lokal pilot klar med 24 foreningsudkast og en skjult øveforening. Ingen eksempelarrangementer er oprettet. Eksisterende data er bevaret.');
console.log('Øvelogin: ansvarlig@example.test. Koden findes kun i den lokale testpostkasse. Ingen eksterne mails sendes.');
