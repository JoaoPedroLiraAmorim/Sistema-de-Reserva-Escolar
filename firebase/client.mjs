import { initializeApp } from 'firebase/app';
import {
    browserPopupRedirectResolver, createUserWithEmailAndPassword, GoogleAuthProvider,
    initializeAuth, inMemoryPersistence, sendEmailVerification, sendPasswordResetEmail,
    signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth';

export function prepararLogin(config) {
    const auth = initializeAuth(initializeApp(config), {
        persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver,
    });
    const google = new GoogleAuthProvider();
    google.setCustomParameters({ prompt: 'select_account' });

    async function concluir(user, api) {
        if (!user.emailVerified) return false;
        try {
            await api('conta/entrar', { idToken: await user.getIdToken() });
            return true;
        } finally {
            await signOut(auth).catch(() => {});
        }
    }

    return {
        async entrar(email, senha, api) {
            const { user } = await signInWithEmailAndPassword(auth, email, senha);
            return concluir(user, api);
        },
        async entrarGoogle(api) {
            const { user } = await signInWithPopup(auth, google);
            if (!await concluir(user, api)) {
                await signOut(auth);
                throw new Error('Escolha uma conta Google com e-mail verificado.');
            }
        },
        async cadastrar(email, senha) {
            const { user } = await createUserWithEmailAndPassword(auth, email, senha);
            await sendEmailVerification(user);
        },
        async reenviar() {
            if (!auth.currentUser || auth.currentUser.emailVerified) throw new Error('Entre com seu e-mail e senha para reenviar.');
            await sendEmailVerification(auth.currentUser);
        },
        async redefinir(email) {
            await sendPasswordResetEmail(auth, email).catch(error => {
                if (error.code !== 'auth/user-not-found') throw error;
            });
        },
    };
}
