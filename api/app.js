/* /api/app — every signed-in action. To add a feature: write the function, add one line below. */
import { requireUser } from './_lib/auth.js';
import { route } from './_lib/http.js';
import * as P from './_lib/actions/providers.js';
import * as S from './_lib/actions/saved.js';
import * as B from './_lib/actions/bookings.js';
import * as A from './_lib/actions/account.js';
import * as Pay from './_lib/actions/payments.js';
import * as R from './_lib/referral.js';

export default route({
  'home': P.home, 'providers.list': P.list, 'providers.get': P.get, 'providers.contact': P.contact,
  'saved.list': S.list, 'saved.set': S.set,
  'bookings.list': B.list, 'bookings.create': B.create, 'bookings.cancel': B.cancel, 'bookings.dispute': B.dispute,
  'bookings.providerCancel': B.providerCancel, 'bookings.done': B.markDone, 'bookings.complete': B.complete,
  'notifications.list': B.notifications, 'notifications.read': B.markRead, 'notifications.clear': B.clearRead, 'counts': B.counts,
  'profile.get': A.profile, 'profile.update': A.updateProfile, 'password.change': A.changePassword, 'avatar.set': A.setAvatar,
  'plans.list': A.plans, 'upgrade.calc': A.upgradeCalc, 'upgrade.manual': A.upgradeManual,
  'pay.checkout': Pay.checkout, 'pay.verify': Pay.verify,
  'referral.redeem': R.redeem,
  'listings.mine': A.listingsMine, 'listings.save': A.listingSave, 'listings.toggle': A.listingToggle, 'listings.delete': A.listingDelete, 'reviews.mine': A.reviewsMine,
  'change.cooldown': A.changeCooldown, 'change.submit': A.changeSubmit, 'report.submit': A.reportSubmit,
  'push.key': A.pushKey, 'push.subscribe': A.pushSubscribe,
  'messages.pending': A.messagesPending, 'messages.ack': A.messageAck,
  'ads.list': A.adsList, 'ads.track': A.adsTrack,
}, { guard: (req) => requireUser(req) });
