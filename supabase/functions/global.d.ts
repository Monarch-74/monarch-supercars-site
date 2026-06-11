// Déclarations d'ambiance pour l'éditeur (VS Code / TS Server "Node").
// Les Edge Functions Supabase tournent sur Deno, qui connaît nativement
// l'objet global `Deno` et les imports HTTPS (https://esm.sh/...).
// Ce fichier sert uniquement à informer l'éditeur — il n'est jamais
// importé ni exécuté par Deno (aucun impact sur le runtime).

declare const Deno: {
  env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare module "https://esm.sh/*" {
  const value: any;
  export default value;
  export const createClient: any;
  export const Stripe: any;
}
