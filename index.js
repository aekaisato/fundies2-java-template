import fs from "fs";
import { findMethodFromClassPage, getClassPageFromName } from "./parse-javadocs.js"

const args = process.argv.slice(2)
const file = fs.readFileSync(args[0], "utf8")

const classRegex = /class [A-Za-z]+ .*{/g
const fieldRegex = /([a-z]+ )?[A-Za-z]+ [a-z][A-Za-z]+;/
const methodRegex = /([a-z]+ )?[A-Za-z]+ [A-Za-z]+\(.*\) {/
// const mffRegex = /this\.[A-Za-z]+\.[A-Z][a-z]+\(.*\)/g

const classes = file.matchAll(classRegex);

const rpad = (str, pad, space = " ") => {
  while (str.length < pad) {
    str += space
  }
  return str;
}

const findClosing = (str) => {
  let arr = str.split("");
  let c = 1;
  for (const i in arr) {
    if (arr[i] === "}") {
      c--;
    } else if (arr[i] === "{") {
      c++;
    }
    if (c === 0) {
      return i;
    }
  }
  console.error("no end found")
  return null;
  // let c = 1;
  // let i = 0;
  // while (c != 0) {
  //   if (str.length <= 0) {
  //     return null;
  //   }
  //   let aIndex = str.indexOf("{")
  //   let zIndex = str.indexOf("}")
  //   if (zIndex < 0) {
  //     return null
  //   }
  //   if (aIndex >= 0 && aIndex < zIndex) {
  //     c++;
  //     i += aIndex;
  //     str = str.substring(aIndex + 1)
  //   } else if (aIndex < 0 || zIndex < aIndex) {
  //     c--;
  //     i += zIndex;
  //     str = str.substring(zIndex + 1)
  //   }
  // }
  // return i;
}

const startsWith = (str, regex) => {
  return regex.test(str.substring(0,1))
}

const startsWithCaps = (str) => {
  return startsWith(str, /[A-Z]/)
}

const startsWithLower = (str) => {
  return startsWith(str, /[a-z]/)
}

for (const c of classes) {
  let className = c[0].split(" ")[1];
  let fields = []; // { name, type }
  let methods = [];
  let methodsForFields = [];
  
  const cStartIndex = c.index + c[0].length;
  const cEndIndex = cStartIndex + findClosing(file.substring(cStartIndex));
  const cc = file.substring(cStartIndex, cEndIndex);
  const lines = cc.split("\n");
  let reachedConstructor = false;
  for (const i in lines) {
    if (/\(.*\)/.test(lines[i])) {
      reachedConstructor = true;
    }

    const fMatch = lines[i].match(fieldRegex);
    if (fMatch != null && !reachedConstructor) {
      let temp = fMatch[0].split(" ");
      let fName;
      let fType;
      for (const j in temp) {
        if (startsWithCaps(temp[j])) {
          fType = temp[j];
          break;
        }
      }
      temp = temp.slice(1);
      for (const j in temp) {
        if (startsWithLower(temp[j])) {
          fName = temp[j].replaceAll(/[{};\(\)]/g, "");
          break;
        }
      }
      fields.push({ name: fName, type: fType })
    }

    const mMatch = lines[i].match(methodRegex);
    if (mMatch != null) {
      let mNameMatch = mMatch[0].match(/[A-Za-z]+\(.*\)/);
      let mName = mNameMatch[0];
      let mTypeArr = mMatch[0].substring(0, mNameMatch.index).split(" ");
      let mType = mTypeArr[mTypeArr.length - 2]
      let inP = mName.substring(mName.indexOf("(") + 1, mName.indexOf(")"));
      let params = inP.split(",").map(x => x.trim()).filter((x) => {return x.length > 0})
      methods.push({ name: mName, type: mType, params: params });
    }
  }

  for (const f in fields) {
    const mffRegex = new RegExp(fields[f].name + "\\.[A-Za-z]+\\(.*\\)", 'g')
    let mffMatches = cc.match(mffRegex);
    for (const j in mffMatches) {
      mffMatches[j] = mffMatches[j].substring(0, mffMatches[j].indexOf("("))
    }
    mffMatches = [...new Set(mffMatches)]
    for (const m in mffMatches) {
      let nameTemp = mffMatches[m].split(".");
      let searchName = nameTemp[nameTemp.length - 1]
      let fieldName = nameTemp[0];
      let field = fields.find(x => x.name == fieldName)
      let methodObj;
      for (const n in methods) {
        if (methods[n].name.substring(0, methods[n].name.indexOf("(")) == searchName)
          { methodObj = methods[n] }
      }
      let foundField = false;
      if (methodObj) {
        let mffName = nameTemp[0] + "." + methodObj.name;
        let mffType = methodObj.type
        methodsForFields.push({ name: mffName, type: mffType })
        foundField = true;
      } else {
        const classpage = await getClassPageFromName(field.type);
        let method = findMethodFromClassPage(classpage, searchName);
        method.name = nameTemp[0] + "." + method.name;
        method.name += " [^]"
        method.type += " [^]"
        methodsForFields.push(method);
        foundField = true;
      } 
      if (!foundField) {
        methodsForFields.push({ name: mffMatches[m] + "([~])", type: "[~]" })
      }
    }
  }

  console.log(className)
  console.log(fields)
  console.log(methods)
  console.log(methodsForFields)
  console.log()

  let templateStr = "";
  templateStr += "/*\n\n"
  templateStr += "FIELDS:\n"
  for (const j in fields) {
    templateStr += rpad("... this." + fields[j].name + " ...", 32) + "  -- " + fields[j].type + "\n";
  }
  templateStr += "\n"
  templateStr += "METHODS:\n"
  for (const j in methods) {
    templateStr += rpad("... this." + methods[j].name + " ...", 32) + "  -- " + methods[j].type + "\n";
  }
  templateStr += "\n"
  templateStr += "METHODS FOR FIELDS:\n"
  for (const j in methodsForFields) {
    templateStr += rpad("... this." + methodsForFields[j].name + " ...", 32) + "  -- " + methodsForFields[j].type + "\n";
  }
  templateStr += "\n*/"

  !fs.existsSync("./out") ? fs.mkdirSync("./out") : () => {};
  fs.writeFileSync("./out/" + className + ".txt", templateStr);
}
