import Document, { Html, Head, Main, NextScript } from "next/document";
import { resolveLocaleFromCookieHeader, DEFAULT_LOCALE } from "@/i18n/resolveLocale";

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const cookieHeader = ctx?.req?.headers?.cookie || "";
    const locale = resolveLocaleFromCookieHeader(cookieHeader);
    return { ...initialProps, locale };
  }

  render() {
    const locale = this.props.locale || DEFAULT_LOCALE;
    return (
      <Html lang={locale}>
        <Head />
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
