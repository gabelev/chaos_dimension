export default function Attribution({ linkStyle, textStyle }) {
  return (
    <span style={textStyle}>
      Created by{' '}
      <a
        href="https://github.com/gabelev"
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
      >
        Putu Gabe Levine
      </a>
      {' '}with help from Claude.
    </span>
  );
}
