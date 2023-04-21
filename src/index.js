function handleError(inner) {
  return () =>
    Promise.resolve(inner()).catch((err) => {
      console.error(err);
      alert(err.message);
    });
}

document.querySelector("#csv").addEventListener(
  "click",
  handleError(async () => {
    const safeTransactionId =
      document.querySelector("#safeTransactionId").value;
    alert(safeTransactionId);
  })
);
