# Free HTL Guide — All-in-one v7

Upload these to your GitHub Pages repo root:
- index.html
- privacy.html, terms.html
- /modules/staining.html, /modules/fixation.html, /modules/processing.html
- /assets/microtome.jpg (use your real high-res image)
- /assets/Stain_Cheat_Sheet.pdf
- robots.txt, sitemap.xml, .nojekyll

## Wire the forms (Formspree)
1) Create an account at https://formspree.io → New Form.
2) You get an endpoint like: `https://formspree.io/f/abcdwxyz`.
3) In **index.html**, replace `YOUR_FORM_ID` in both forms (Lead magnet + Contact) with your real ID.
4) In Formspree, set an auto-reply email that includes a link to:
   `https://withnati.github.io/free-htl-guide-site/assets/Stain_Cheat_Sheet.pdf`

## Analytics (choose one)
- **GA4**: replace `G-XXXXXXX` in the head with your Measurement ID.
- **Plausible**: replace `yourdomain.com` in the script tag with your domain.

## Custom domain (optional)
1) Buy a domain (e.g., Namecheap/Google Domains).
2) In your repo → Settings → Pages → add your domain (e.g., freehtlguide.com). GitHub will create a **CNAME** file.
3) In your domain DNS, add **A records** to GitHub Pages IPs and a **CNAME** for `www` to `yourusername.github.io` (GitHub gives exact values). Enable HTTPS.

## After launch
- Replace placeholder testimonials and add real names/roles (with permission).
- Swap in real PDFs (stain tables, fixative sheets).
- Build remaining modules (Processing, Lab Ops, IHC deep dives).
