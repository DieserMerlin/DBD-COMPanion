import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { PropsWithChildren } from "react";
import { theme } from "../mui/theme";
import { MotionConfig } from "motion/react";

const cleanCss = `
body {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  -moz-backface-visibility: hidden;
}


* {
  scrollbar-width: none; /* Firefox */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}


img {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}

input, textarea /*.contenteditable?*/
{
  -webkit-touch-callout: default;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

*::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}
`;

const bodyTransparentCss = `
body {
  background: transparent !important;
}
`;

export const BaseWindow = (props: PropsWithChildren<{ transparent?: boolean, fullWindowDrag?: boolean }>) => {
  return (
    <>
      {props.fullWindowDrag && <div style={{
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        zIndex: 999999,
      }} id="header" />}
      <MotionConfig transition={{ duration: .3, ease: [.29, .29, .17, 1] }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles styles={cleanCss} />
          {props.transparent && <GlobalStyles styles={bodyTransparentCss} />}
          {props.children}
        </ThemeProvider>
      </MotionConfig>
    </>
  );
}