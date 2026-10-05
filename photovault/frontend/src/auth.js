import {
  CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute,
} from "amazon-cognito-identity-js";

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_CLIENT_ID,
});

const wrap = (fn) => new Promise((res, rej) => fn((err, data) => (err ? rej(err) : res(data))));
const user = (email) => new CognitoUser({ Username: email, Pool: pool });

export const signUp = (email, password) =>
  wrap((cb) => pool.signUp(email, password, [new CognitoUserAttribute({ Name: "email", Value: email })], null, cb));

export const confirmSignUp = (email, code) =>
  wrap((cb) => user(email).confirmRegistration(code, true, cb));

export const signIn = (email, password) =>
  new Promise((onSuccess, onFailure) =>
    user(email).authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), { onSuccess, onFailure })
  );

export const signOut = () => pool.getCurrentUser()?.signOut();

// Returns a valid ID token (auto-refreshes) or null if logged out
export const getToken = () =>
  new Promise((resolve) => {
    const u = pool.getCurrentUser();
    if (!u) return resolve(null);
    u.getSession((err, s) => resolve(err || !s?.isValid() ? null : s.getIdToken().getJwtToken()));
  });

// Returns the logged-in user's email (from the ID token) or ""
export const getEmail = () =>
  new Promise((resolve) => {
    const u = pool.getCurrentUser();
    if (!u) return resolve("");
    u.getSession((err, s) => resolve(err || !s?.isValid() ? "" : s.getIdToken().payload.email || ""));
  });
