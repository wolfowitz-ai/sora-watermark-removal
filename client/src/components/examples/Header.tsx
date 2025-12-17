import Header from "../Header";

export default function HeaderExample() {
  return <Header onNewUpload={() => console.log("New upload clicked")} />;
}
