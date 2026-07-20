# Controle Muay Thai e Boxe

Aplicativo simples para controlar alunos, cobranças, pagamentos, categorias e totais.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie estes arquivos para o repositório.
3. No GitHub, vá em `Settings` > `Pages`.
4. Em `Build and deployment`, escolha `Deploy from a branch`.
5. Selecione a branch `main` e a pasta `/root`.

Depois disso, o GitHub vai gerar um link público para abrir no computador e no celular.
## Login e banco de dados

O app esta preparado para usar Supabase.

1. Crie um projeto no Supabase.
2. Rode o arquivo `supabase-schema.sql` no SQL Editor do Supabase.
3. Crie os usuarios em `Authentication`.
4. Na tabela `profiles`, cadastre o `user_id` de cada usuario com `role`:
   - `admin` para o Vinicius.
   - `professor` para o professor.
5. Copie a URL do projeto e a chave publica `anon` para `supabase-config.js`.

Quando o Supabase estiver configurado, o app passa a exigir login. O professor ve somente uma lista simples com aluno, status de pagamento e categoria. O admin edita e usa o botao `Salvar alterações` para gravar no banco.
