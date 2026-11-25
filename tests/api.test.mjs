// Tests de l'API (à lancer avec l'application démarrée et les données de démo) :
//   node tests/api.test.mjs   (ou API_URL=http://localhost:3000/api node tests/api.test.mjs)
const B=process.env.API_URL||'http://localhost:3000/api'; let fails=0, n=0;
async function call(method, url, token, body){ const r=await fetch(B+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}); let d={}; try{d=await r.json()}catch{}; return {s:r.status,d}; }
function check(name, cond, extra=''){ n++; if(!cond){fails++; console.log('FAIL', name, extra);} else console.log('ok  ', name); }
const login=async(company,email,password='demo1234')=>(await call('POST','/auth/login',null,{company,email,password}));
const alice=(await login('acme','alice@acme.fr')).d.token, bob=(await login('acme','bob@acme.fr')).d.token, david=(await login('acme','david@acme.fr')).d.token, emma=(await login('globex','emma@globex.fr')).d.token;
check('login 4 comptes', alice&&bob&&david&&emma);
check('mauvais mdp 401', (await login('acme','alice@acme.fr','xx')).s===401);
check('même email autre entreprise -> autre compte', (await login('globex','alice@acme.fr')).d.user?.role==='MEMBER');
check('login champ manquant 400', (await call('POST','/auth/login',null,{email:'a@b.c'})).s===400);
check('sans token 401', (await call('GET','/projects')).s===401);
check('token bidon 401', (await call('GET','/projects','abc')).s===401);
const ap=(await call('GET','/projects',alice)).d.projects; const gp=(await call('GET','/projects',emma)).d.projects;
check('alice voit 2 projets', ap.length===2); check('emma voit 1 projet', gp.length===1);
const globexProj=gp[0]._id, acmeProj=ap.find(p=>p.name.startsWith('Refonte'))._id, mobile=ap.find(p=>p.name.startsWith('Application'))._id;
check('isolation: alice GET projet globex 404', (await call('GET','/projects/'+globexProj,alice)).s===404);
check('isolation: alice tasks globex 404', (await call('GET',`/projects/${globexProj}/tasks`,alice)).s===404);
check('isolation: alice PUT projet globex 404', (await call('PUT','/projects/'+globexProj,alice,{name:'pwn'})).s===404);
check('isolation: alice DELETE projet globex 404', (await call('DELETE','/projects/'+globexProj,alice)).s===404);
const gtasks=(await call('GET',`/projects/${globexProj}/tasks`,emma)).d.tasks;
check('isolation: alice PATCH tache globex via son projet 404', (await call('PATCH',`/projects/${acmeProj}/tasks/${gtasks[0]._id}`,alice,{title:'x'})).s===404);
const gusers=(await call('GET','/users',emma)).d.users;
check('isolation: users listés = entreprise', gusers.length===2);
check('isolation: alice PUT user globex 404', (await call('PUT','/users/'+gusers[0]._id,alice,{name:'x'})).s===404);
check('isolation: alice DELETE user globex 404', (await call('DELETE','/users/'+gusers[0]._id,alice)).s===404);
check('isolation: projet avec membre externe 400', (await call('POST','/projects',alice,{name:'X',members:[gusers[0]._id]})).s===400);
check('id invalide 404', (await call('GET','/projects/123',alice)).s===404);
// visibilité par membre
const bp=(await call('GET','/projects',bob)).d.projects, dp=(await call('GET','/projects',david)).d.projects;
check('bob voit 2 projets (membre)', bp.length===2); check('david voit 1 projet', dp.length===1);
check('david ne voit pas projet mobile 404', (await call('GET','/projects/'+mobile,david)).s===404);
// droits
check('viewer ne crée pas de tâche 403', (await call('POST',`/projects/${acmeProj}/tasks`,david,{title:'x'})).s===403);
check('member ne crée pas de projet 403', (await call('POST','/projects',bob,{name:'x'})).s===403);
check('member ne crée pas d user 403', (await call('POST','/users',bob,{name:'x',email:'x@x.fr',password:'12345678'})).s===403);
const users=(await call('GET','/users',alice)).d.users; const uid=e=>users.find(u=>u.email===e)._id;
const t=await call('POST',`/projects/${acmeProj}/tasks`,bob,{title:'Test tâche',assigned_to:uid('chloe@acme.fr'),due_date:'2026-12-01',tags:['a','b']});
check('member crée tâche 201', t.s===201, JSON.stringify(t.d));
check('assignation hors projet 400', (await call('POST',`/projects/${mobile}/tasks`,alice,{title:'x',assigned_to:uid('chloe@acme.fr')})).s===400);
check('assigned_to invalide 400', (await call('POST',`/projects/${acmeProj}/tasks`,alice,{title:'x',assigned_to:'zzz'})).s===400);
check('date invalide 400', (await call('POST',`/projects/${acmeProj}/tasks`,alice,{title:'x',due_date:'pas une date'})).s===400);
check('statut invalide 400', (await call('PATCH',`/projects/${acmeProj}/tasks/${t.d.task._id}`,bob,{status:'NOPE'})).s===400);
const mv=await call('PATCH',`/projects/${acmeProj}/tasks/${t.d.task._id}`,bob,{status:'REVIEW',position:1.5});
check('déplacement kanban', mv.s===200 && mv.d.task.status==='REVIEW' && mv.d.task.position===1.5);
check('chloe (member, pas auteure) ne supprime pas 403', (await call('DELETE',`/projects/${acmeProj}/tasks/${t.d.task._id}`,(await login('acme','chloe@acme.fr')).d.token)).s===403);
check('auteur supprime 200', (await call('DELETE',`/projects/${acmeProj}/tasks/${t.d.task._id}`,bob)).s===200);
// CRUD projet + membres
const np=await call('POST','/projects',alice,{name:'Projet test',members:[uid('bob@acme.fr')],color:'#16a34a'});
check('créer projet (créateur auto membre)', np.s===201 && np.d.project.members.length===2);
const nt=await call('POST',`/projects/${np.d.project._id}/tasks`,alice,{title:'t',assigned_to:uid('bob@acme.fr')});
const up=await call('PUT','/projects/'+np.d.project._id,alice,{name:'Projet renommé',members:[uid('alice@acme.fr')],status:'ON_HOLD'});
check('modifier projet', up.s===200 && up.d.project.name==='Projet renommé' && up.d.project.members.length===1);
const tt=(await call('GET',`/projects/${np.d.project._id}/tasks`,alice)).d.tasks;
check('retrait membre => tâche désassignée', tt[0].assigned_to===null);
check('couleur invalide 400', (await call('PUT','/projects/'+np.d.project._id,alice,{color:'red'})).s===400);
check('supprimer projet', (await call('DELETE','/projects/'+np.d.project._id,alice)).s===200);
check('tâches supprimées avec le projet', (await call('GET',`/projects/${np.d.project._id}/tasks`,alice)).s===404);
// CRUD users
const nu=await call('POST','/users',alice,{name:'Eve Test',email:'eve@acme.fr',password:'motdepasse',role:'VIEWER'});
check('créer user', nu.s===201);
check('email doublon 409', (await call('POST','/users',alice,{name:'E',email:'eve@acme.fr',password:'motdepasse'})).s===409);
check('mdp court 400', (await call('POST','/users',alice,{name:'E',email:'e2@acme.fr',password:'123'})).s===400);
check('email invalide 400', (await call('POST','/users',alice,{name:'E',email:'pasunemail',password:'12345678'})).s===400);
const eve=(await login('acme','eve@acme.fr','motdepasse')).d.token;
check('eve se connecte', !!eve);
check('eve modifie son nom', (await call('PUT','/users/'+nu.d.user._id,eve,{name:'Eve T.'})).d.user?.name==='Eve T.');
check('eve ne change pas son rôle 403', (await call('PUT','/users/'+nu.d.user._id,eve,{role:'ADMIN'})).s===403);
check('eve ne modifie pas bob 403', (await call('PUT','/users/'+uid('bob@acme.fr'),eve,{name:'x'})).s===403);
check('admin promeut eve', (await call('PUT','/users/'+nu.d.user._id,alice,{role:'MEMBER'})).d.user?.role==='MEMBER');
check('rôle pris en compte sans reconnexion', (await call('GET','/auth/me',eve)).d.user?.role==='MEMBER');
check('dernier admin non rétrogradable 400', (await call('PUT','/users/'+uid('alice@acme.fr'),alice,{role:'MEMBER'})).s===400);
check('admin ne se supprime pas 400', (await call('DELETE','/users/'+uid('alice@acme.fr'),alice)).s===400);
check('supprimer eve', (await call('DELETE','/users/'+nu.d.user._id,alice)).s===200);
check('token eve invalide après suppression 401', (await call('GET','/projects',eve)).s===401);
// mes tâches + company
check('mes tâches bob', (await call('GET','/tasks/mine',bob)).d.tasks.length>0);
check('david ne voit pas les tâches mobile dans mine', (await call('GET','/tasks/mine',david)).s===200);
const c=await call('GET','/company',alice); check('GET company + stats', c.d.company.slug==='acme' && c.d.stats.users===4);
check('member ne modifie pas company 403', (await call('PUT','/company',bob,{name:'x'})).s===403);
check('modifier company', (await call('PUT','/company',alice,{name:'Acme Studio',description:'Agence web de démonstration.'})).s===200);
// register + delete company
const r=await call('POST','/auth/register',null,{company_name:'Acme Studio',name:'Zoé',email:'zoe@x.fr',password:'12345678'});
check('register slug unique', r.s===201 && r.d.company.slug!=='acme' && r.d.company.slug.startsWith('acme-studio'), r.d.company?.slug);
check('register mdp court 400', (await call('POST','/auth/register',null,{company_name:'A',name:'Z',email:'z@x.fr',password:'1'})).s===400);
check('delete company mauvaise confirm 400', (await call('DELETE','/company',r.d.token,{confirm:'nope'})).s===400);
check('delete company', (await call('DELETE','/company',r.d.token,{confirm:'Acme Studio'})).s===200);
check('compte supprimé avec entreprise', (await call('GET','/auth/me',r.d.token)).s===401);
check('JSON invalide 400', (await fetch(B+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'})).status===400);
check('route api inconnue 404', (await call('GET','/nope',alice)).s===404);
console.log(`\n${n-fails}/${n} tests OK`); process.exit(fails?1:0);
