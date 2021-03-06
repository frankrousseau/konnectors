// Generated by CoffeeScript 1.10.0
var Bill, cheerio, cozydb, fetcher, filterExisting, linkBankOperation, localization, log, logIn, moment, parsePage, request, saveDataAndFile;

cozydb = require('cozydb');

request = require('request');

moment = require('moment');

cheerio = require('cheerio');

fetcher = require('../lib/fetcher');

filterExisting = require('../lib/filter_existing');

saveDataAndFile = require('../lib/save_data_and_file');

linkBankOperation = require('../lib/link_bank_operation');

localization = require('../lib/localization_manager');

log = require('printit')({
  prefix: "Digital Ocean",
  date: true
});

Bill = require('../models/bill');

module.exports = {
  name: "Digital Ocean",
  slug: "digitalocean",
  description: 'konnector description digital ocean',
  vendorLink: "https://www.digitalocean.com/",
  fields: {
    login: "text",
    password: "password",
    folderPath: "folder"
  },
  models: {
    bill: Bill
  },
  init: function(callback) {
    return callback();
  },
  fetch: function(requiredFields, callback) {
    log.info("Import started");
    return fetcher["new"]().use(logIn).use(parsePage).use(filterExisting(log, Bill)).use(saveDataAndFile(log, Bill, 'digital_ocean', ['bill'])).use(linkBankOperation({
      log: log,
      model: Bill,
      identifier: 'ocean',
      dateDelta: 4,
      amountDelta: 5
    })).args(requiredFields, {}, {}).fetch(function(err, fields, entries) {
      var localizationKey, notifContent, options, ref;
      log.info("Import finished");
      notifContent = null;
      if ((entries != null ? (ref = entries.filtered) != null ? ref.length : void 0 : void 0) > 0) {
        localizationKey = 'notification digital ocean';
        options = {
          smart_count: entries.filtered.length
        };
        notifContent = localization.t(localizationKey, options);
      }
      return callback(err, notifContent);
    });
  }
};

logIn = function(requiredFields, billInfos, data, next) {
  var billOptions, logInOptions, signInOptions;
  logInOptions = {
    method: 'GET',
    jar: true,
    url: "https://cloud.digitalocean.com/login"
  };
  signInOptions = {
    method: 'POST',
    jar: true,
    url: "https://cloud.digitalocean.com/sessions",
    form: {
      'user[email]': requiredFields.login,
      'user[password]': requiredFields.password,
      commit: 'Log+In'
    }
  };
  billOptions = {
    method: 'GET',
    jar: true,
    url: "https://cloud.digitalocean.com/settings/billing"
  };
  return request(logInOptions, function(err, res, body) {
    var $, token;
    if (err) {
      next(err);
    }
    $ = cheerio.load(body);
    token = $("input[name=authenticity_token]").val();
    signInOptions.form.authenticity_token = token;
    log.info('Logging in');
    return request(signInOptions, function(err, res, body) {
      if (err) {
        log.error('Login failed');
        return log.raw(err);
      } else {
        log.info('Login succeeded');
        log.info('Fetch bill info');
        return request(billOptions, function(err, res, body) {
          if (err) {
            log.error('An error occured while fetching bills');
            console.log(err);
            return next(err);
          } else {
            log.info('Fetch bill info succeeded');
            data.html = body;
            return next();
          }
        });
      }
    });
  });
};

parsePage = function(requiredFields, bills, data, next) {
  var $;
  bills.fetched = [];
  $ = cheerio.load(data.html);
  log.info('Parsing bill pages');
  $('table.listing tr').each(function() {
    var firstCell, fourthCell, pdfurlPrefix, secondCell, thirdCell;
    secondCell = $(this).find('td').get(1);
    if ((secondCell != null) && $(secondCell).html().indexOf('Invoice') > -1) {
      firstCell = $($(this).find('td').get(0));
      thirdCell = $($(this).find('td').get(2));
      fourthCell = $($(this).find('td').get(3));
      pdfurlPrefix = 'https://cloud.digitalocean.com';
      return bills.fetched.push({
        date: moment(firstCell.html()),
        amount: parseFloat(thirdCell.html().replace('$', '')),
        pdfurl: pdfurlPrefix + fourthCell.find('a').attr('href'),
        vendor: 'Digital Ocean',
        type: 'hosting'
      });
    }
  });
  if (bills.fetched.length === 0) {
    log.error("No bills retrieved");
    return next('no bills retrieved');
  } else {
    log.info("Bill parsed: " + bills.fetched.length + " found");
    return next();
  }
};
