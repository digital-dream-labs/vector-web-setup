let pterm_current_line = "";
let pterm_current_pos = 0;
let pterm_history_list = [];
let pterm_history_pos = 0;
let pterm_cmd_event = [];
let pterm_env_event = [];
let pterm_handled = false;
let pterm_prompt = "$";
let pterm_env = {};
let pterm_editing = true;
let pterm_prompt_promise = null;
const pterm_env_var_regex = /([A-Z_]?[A-Z0-9_]*)/
const pterm_quote_regex = /(["'])(.*)(?<!\\)\1/

// code here
function newLine() {
  let line = "<div class=\"pterm-line\">" + 
    "<div class=\"pterm-prompt\">" + pterm_prompt + "</div>" + 
    "<div class=\"pterm-row pterm-current\"><span class=\"pterm-text\"></span><div class=\"pterm-cursor\"></div></div>" +
    "</div>"; 
  pterm_current_line = "";
  pterm_current_pos = 0;
  pterm_history_pos = pterm_history_list.length;
  let p = $(".pterm-current");
  p.removeClass("pterm-current");
  p.children(".pterm-cursor").remove();
  let m = $(".pterm-main");
  m.append(line);
  m.scrollTop(m.prop("scrollHeight"));
  $(".pterm-cursor").css("visibility", "visible");
  pterm_editing = true;
}

function pterm_set(name, value) {
  pterm_env[name] = value;
}

function pterm_on(event, callback) {
  switch(event) {
    case 'cmd':
      pterm_cmd_event.push(callback);
      break;
    case 'env':
      pterm_env_event.push(callback);
      break;
    default:
      break;
  }
}

function execute(event_list, args) {
  if(pterm_prompt_promise) {
    pterm_prompt_promise.resolve(args);
    pterm_prompt_promise = null;
    newLine();
  } else {
    for(let i = 0; i < event_list.length; i++) {
      event_list[i](args);
    }
  }

  if(event_list.length == 0) {
    pterm_handled = true;
  }
}

//
// ------------------------------------------------------------------------------------------------
// 
function getArgsFromLine(line) {
  let c_pos = 0;
  let args = [];
  let parsing = false;
  let s_pos = 0;

  while(c_pos < line.length) {
    let c = line.charAt(c_pos);
    if(c == ' ') {
      // skip over whitespace
      c_pos++;
      continue;
    }

    if(!parsing) {
      s_pos = c_pos;
      parsing = true;
    }

    if(c == '"' || c == "'") {
      let arg = parseQuote(line.substring(c_pos));
      c_pos += arg.length + 1;
    }

    // advance character
    c_pos++;

    // peak
    if((line.charAt(c_pos) == ' ' || c_pos == line.length) && parsing) {
      args.push(line.substring(s_pos, c_pos));
      parsing = false;
    }
  }

  for(let i = 0; i < args.length; i++) {
    let valueMatchString = new RegExp('^' + pterm_quote_regex.source + '$');
    let valueResult = args[i].match(valueMatchString);

    if(valueResult != null) {
      args[i] = valueResult[2];
    }

    if(args[i].length > 0 && args[i].charAt(0) == '$') {
      let k = args[i].substring(1);
      if(k in pterm_env) {
        args[i] = pterm_env[k];
      } else {
        args[i] = "";
      }
    }
  }

  return args;
}

function parseQuote(line) {
  let c_pos = 1;
  let c = line.charAt(0);

  while(c_pos < line.length) {
    if(line.charAt(c_pos) == c) {
      return line.substring(1, c_pos);
    }
    c_pos++;
  }

  return line.substring(1);
} 

function pterm_changeprompt(str, color) {
  if(color) {
    str = "<span class=\"pterm-" + color + "\">" + str + "</span>";
  }

  pterm_prompt = str + '$';

  $(".pterm-current").siblings(".pterm-prompt").html(pterm_prompt);
}

function pterm_changeprompt_once(str, color) {
  if(color) {
    str = "<span class=\"pterm-" + color + "\">" + str + "</span>";
  }

  $(".pterm-current").siblings(".pterm-prompt").html(str);
}

function pterm_read(input) {
  let p = new Promise(function(resolve, reject) {
    pterm_prompt_promise = { resolve:resolve, reject:reject };
    newLine();
    pterm_changeprompt_once(input, null);
  });

  return p;
}

function pterm_print(text) {
  while(text.includes("\x1b[")) {
    text = text.replace("\x1b[0m", "</span>");
    text = text.replace("\x1b[91m", "<span class=\"pterm-red\">");
    text = text.replace("\x1b[92m", "<span class=\"pterm-green\">");
    text = text.replace("\x1b[93m", "<span class=\"pterm-yellow\">");
  }

  let lines = text.split("\n");

  for(let i = 0; i < lines.length; i++) {
    let txt = "<div class=\"pterm-line\">" +
      "<div class=\"pterm-row pterm-text\">" +
      lines[i] + "</div></div>";

    $(".pterm-main").append(txt);
  }
}

function pterm_print_overwrite(text) {
  while(text.includes("\x1b[")) {
    text = text.replace("\x1b[0m", "</span>");
    text = text.replace("\x1b[91m", "<span class=\"pterm-red\">");
    text = text.replace("\x1b[92m", "<span class=\"pterm-green\">");
    text = text.replace("\x1b[93m", "<span class=\"pterm-yellow\">");
  }

  let lines = text.split("\n");

  for(let i = 0; i < lines.length; i++) {
    if(i == 0) {
      $(".pterm-row.pterm-text").last().html(txt);
    } else {
      let txt = "<div class=\"pterm-line\">" +
        "<div class=\"pterm-row pterm-text\">" +
        lines[i] + "</div></div>";
      $(".pterm-main").append(txt);
    }
  }
}

function pterm_new_progress_bar() {
  let txt = "<div class=\"pterm-line\">" +
      "<div class=\"pterm-row pterm-full pterm-text\">" +
      "<div class=\"pterm-progress-bar\">" +
      "<div class=\"pterm-progress-bar-track\">" +
      "</div></div></div></div>";

  $(".pterm-main").append(txt);
  let m = $(".pterm-main"); 
  m.scrollTop(m.prop("scrollHeight"));
}

function pterm_new_button(value) {
  let id = "id-" + Math.floor(Math.random() * 10000000);
  let txt = "<div class=\"pterm-line\">" +
      "<div class=\"pterm-row pterm-full pterm-text\">" +
      "<input id=\"" + id + "\" type=\"button\" class=\"pterm-button\" value=\"" + value + "\"/>"
      "</div></div>";

  $(".pterm-main").append(txt); 
  return id;
}

function pterm_set_progress_bar(val, max) {
  let p = (val/max) * 100;
  $(".pterm-progress-bar-track").last().width(p + "%");
}

//
// ------------------------------------------------------------------------------------------------
// 

function pterm_insert_history(line) {
  pterm_history_list.push(line);
  pterm_history_pos = pterm_history_list.length;
}

function processLine(line) {
  if(line == "") {
    return;
  }

  let args = getArgsFromLine(line);

  if(args[0] == "echo") {
    if(args[1] != null) {
      pterm_print(args[1]);
    }
    pterm_handled = true;
  } else if(args[0] == "printenv") {
    let envKeys = Object.keys(pterm_env); 
    for(let i = 0; i < envKeys.length; i++) {
      pterm_print(envKeys[i] + "=" + pterm_env[envKeys[i]]);
    }
    pterm_handled = true;
  } else if(args[0] == "export" || args[0] == "set") {
    let matchString = new RegExp('^' + pterm_env_var_regex.source + '=' + '(.+)' + '$');
    
    for(let i = 1; i < args.length; i++) {
      let result = args[i].match(matchString);

      if(result != null) {
        // found a match to export
        let valueMatchString = new RegExp('^' + pterm_quote_regex.source + '$');
        let valueResult = result[2].match(valueMatchString);

        let value = result[2];

        if(valueResult != null) {
          value = valueResult[2];
        }

        pterm_set(result[1], value);
      }
    }

    for(let i = 0; i < pterm_env_event.length; i++) {
      pterm_env_event[i]();
    }
    
    pterm_handled = true;
  } else if(args[0] == "unset") {
    if(args[1] in pterm_env) {
      delete pterm_env[args[1]];
      for(let i = 0; i < pterm_env_event.length; i++) {
        pterm_env_event[i]();
      } 
    }
    pterm_handled = true;
  } else {
    $(".pterm-cursor").css("visibility", "hidden");
    pterm_editing = false;
    execute(pterm_cmd_event, args);
  }

  pterm_insert_history(line);
}

$(document).ready(function() {
  $(document).keydown(function(event) {
    if($("*").is(":focus")) {
      return;
    }
    
    pterm_process_key(event);
  });
});

function pterm_process_key(event) {
  // don't scroll on arrow or space
  if([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
    event.preventDefault();
  }

  if(event.metaKey) {
    if(event.key == "k") {
      $(".pterm-line:not(:last)").remove();
    }
  }
  else if(event.altKey) {
    if(event.key == "ArrowLeft") {
      if(pterm_current_pos == 0) {
        return;
      }

      pterm_current_pos--;
            
      let c = pterm_current_line.charAt(pterm_current_pos);

      // 1. if c is space, then continue until non-space, 
      // and then just right of next space
      // 2. if c is non-space, then continue until just right of next space

      if(c == ' ') {
        while((c=pterm_current_line.charAt(pterm_current_pos)) == ' ' && pterm_current_pos > 0) {
          pterm_current_pos--;
        }  
      }

      while((c=pterm_current_line.charAt(pterm_current_pos)) != ' ' && pterm_current_pos > 0) {
        pterm_current_pos--;
      }

      if(pterm_current_pos != 0 || pterm_current_line.charAt(0) == ' ') {
        pterm_current_pos++;
      }
    }
    else if(event.key == "ArrowRight") {
      if(pterm_current_pos == pterm_current_line.length) {
        return;
      }
            
      let c = pterm_current_line.charAt(pterm_current_pos);

      // 1. if c is space, then continue until non-space, 
      // 2. if c is non-space, then continue until just right of next space

      if(c != ' ') {
        while((c=pterm_current_line.charAt(pterm_current_pos)) != ' ' && pterm_current_pos < pterm_current_line.length) {
          pterm_current_pos++;
        }
      }

      while((c=pterm_current_line.charAt(pterm_current_pos)) == ' ' && pterm_current_pos < pterm_current_line.length) {
        pterm_current_pos++;
      }  
    }
  }
  else if(event.ctrlKey) {
    if(event.key == "a") {
      pterm_current_pos = 0;
    }
    else if(event.key == "e") {
      pterm_current_pos = pterm_current_line.length;
    }
    else if(event.key == "c") {
      newLine();
    }
    else if(event.key == "r") {
      // reverse search
    }
  }
  else if(event.key == "ArrowLeft") {
    if(pterm_current_pos > 0) {
      pterm_current_pos--;
    }
  }
  else if(event.key == "ArrowRight") {
    if(pterm_current_pos < pterm_current_line.length) {
      pterm_current_pos++;
    }
  }
  else if(event.key == "ArrowUp") {
    if(pterm_history_pos == 0) {
      return;
    }

    let line = pterm_history_list[--pterm_history_pos];
    pterm_current_line = line;
    pterm_current_pos = line.length;
  }
  else if(event.key == "ArrowDown") {
    if(pterm_history_pos >= pterm_history_list.length - 1) {
      return;
    }
    
    let line = pterm_history_list[++pterm_history_pos];
    pterm_current_line = line;
    pterm_current_pos = line.length;
  }
  else if(event.key == "Delete") {
    // delete
    if(pterm_current_pos < pterm_current_line.length) {
      pterm_current_line = pterm_current_line.substring(0, pterm_current_pos) + 
                           pterm_current_line.substring(pterm_current_pos + 1);
    } 
  }
  else if(event.key == "Enter") {
    // handle Enter
    pterm_handled = false;
    processLine(pterm_current_line);
    if(pterm_handled) {
      newLine();
    }
  }
  else if(event.keyCode == 8) {
    if(pterm_current_pos > 0) {
      pterm_current_line = pterm_current_line.substring(0, pterm_current_pos - 1) + 
                           pterm_current_line.substring(pterm_current_pos);
      pterm_current_pos--;
    }
  }
  else if((32 <= event.keyCode && event.keyCode <= 126) || (event.key.length == 1)) {
    let key = event.key;

    pterm_current_line = pterm_current_line.substring(0, pterm_current_pos) + 
                         key +
                         pterm_current_line.substring(pterm_current_pos);
    pterm_current_pos++;
  }
  else {
    // console.log(event);
  }

  let w = $(".pterm-cursor").width();
  $(".pterm-current > .pterm-text").html(pterm_current_line);
  $(".pterm-current").width(w * (pterm_current_line.length + 1));
  $(".pterm-cursor").css("left", w * pterm_current_pos);
}

$(document).on("paste", function(event){
  // get clipboard data
  let data = event.originalEvent.clipboardData.getData('text');
  pterm_current_line = pterm_current_line.substring(0, pterm_current_pos) + 
                       data +
                       pterm_current_line.substring(pterm_current_pos);
  pterm_current_pos += data.length;

  let w = $(".pterm-cursor").width();
  $(".pterm-current > .pterm-text").html(pterm_current_line);
  $(".pterm-current").width(w * (pterm_current_line.length + 1));
  $(".pterm-cursor").css("left", w * pterm_current_pos);
});