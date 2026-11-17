import { requireUser } from './_lib/auth.js';
import { route } from './_lib/http.js';
import actions from './_lib/actions/admin.js';

export default route(actions, { guard: (req) => requireUser(req, ['admin']) });
