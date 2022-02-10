import fetch from "node-fetch";
import jsdom from "jsdom";
const { JSDOM } = jsdom;

const baseUrl = "https://docs.oracle.com/en/java/javase/11/docs/api/";

const parseFromUrl = async (url) => {
  const res = await (await fetch(url)).text();
  const dom = new JSDOM(res, "application/html")
  return dom
}

const findClassUrlFromDom = (dom, name) => {
  const doc = dom.window.document;
  const ul = doc.querySelector("ul");
  const c = ul.children;
  for (let i = 0; i < c.length; i++) {
    const child = c[i].firstElementChild;
    const cName = child.firstElementChild ? child.firstElementChild.innerHTML : child.innerHTML;
    if (cName == name) {
      return child.getAttribute("href");
    }
  }
}

const getClassPageFromName = async (name) => {
  return await parseFromUrl(baseUrl + findClassUrlFromDom(
    await parseFromUrl(baseUrl + "allclasses.html"), name));
}

const findMethodFromClassPage = (classpage, method) => {
  const table = classpage.window;
  let i = 0;
  while (table["i" + i]) {
    let row = table["i" + i];
    let methodName = row.querySelector(".colSecond").querySelector("a").innerHTML.trim();
    let methodNameFull = row.querySelector(".colSecond").querySelector("code").textContent.trim();
    methodNameFull = methodNameFull.replaceAll(/[\u200B-\u200D\uFEFF]/g, "");
    let methodType = row.querySelector(".colFirst").querySelector("code");
    methodType = methodType.firstElementChild ? methodType.firstElementChild.innerHTML : methodType.innerHTML;
    if (methodName == method) {
      return { name: methodNameFull, type: methodType }
    }
    i++;
  }
}

export { findMethodFromClassPage, getClassPageFromName };

