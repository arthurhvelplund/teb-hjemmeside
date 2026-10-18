import {handlePosts} from './posts.mjs';
export {validatePost} from './posts.mjs';
export const experiment=(request,env,auth,route,data)=>handlePosts(request,env,auth,route,data,{legacy:true});
