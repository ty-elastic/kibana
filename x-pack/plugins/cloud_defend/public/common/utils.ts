/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import yaml from 'js-yaml';
import { NewPackagePolicy } from '@kbn/fleet-plugin/public';
import { i18n } from '@kbn/i18n';
import { errorBlockActionRequiresTargetFilePath } from '../components/control_general_view/translations';
import {
  Selector,
  Response,
  SelectorType,
  DefaultFileSelector,
  DefaultProcessSelector,
  DefaultFileResponse,
  DefaultProcessResponse,
  SelectorConditionsMap,
  SelectorCondition,
} from '../types';
import {
  MAX_CONDITION_VALUE_LENGTH_BYTES,
  MAX_SELECTORS_AND_RESPONSES_PER_TYPE,
  FIM_OPERATIONS,
} from './constants';

export function getInputFromPolicy(policy: NewPackagePolicy, inputId: string) {
  return policy.inputs.find((input) => input.type === inputId);
}

export function getSelectorTypeIcon(type: SelectorType) {
  switch (type) {
    case 'process':
      return 'gear';
    case 'file':
    default:
      return 'document';
  }
}

export function camelToSentenceCase(prop: string) {
  const sentence = prop.replace(/([A-Z])/g, ' $1').toLowerCase();
  return sentence[0].toUpperCase() + sentence.slice(1);
}

export function conditionCombinationInvalid(
  addedConditions: SelectorCondition[],
  condition: SelectorCondition
): boolean {
  const options = SelectorConditionsMap[condition];
  const invalid = addedConditions.find((added) => {
    return options?.not?.includes(added);
  });

  return !!invalid;
}

type TotalByType = {
  [key in SelectorType]: number;
};

export function getTotalsByType(selectors: Selector[], responses: Response[]) {
  const totalsByType: TotalByType = { process: 0, file: 0 };

  selectors.forEach((selector) => {
    totalsByType[selector.type]++;
  });

  responses.forEach((response) => {
    totalsByType[response.type]++;
  });

  return totalsByType;
}

function selectorUsesFIM(selector?: Selector) {
  return (
    selector &&
    (!selector.operation ||
      selector.operation.length === 0 ||
      selector.operation.some((r) => FIM_OPERATIONS.indexOf(r) >= 0))
  );
}

function selectorsIncludeConditionsForFIMOperations(
  selectors: Selector[],
  conditions: SelectorCondition[],
  selectorNames?: string[],
  requireForAll?: boolean
) {
  const result =
    selectorNames &&
    selectorNames.reduce((prev, cur) => {
      const selector = selectors.find((s) => s.name === cur);
      const usesFIM = selectorUsesFIM(selector);
      const hasAllConditions =
        !usesFIM ||
        !!(
          selector &&
          conditions.reduce((p, c) => {
            return p && selector.hasOwnProperty(c);
          }, true)
        );

      if (requireForAll) {
        return prev && hasAllConditions;
      } else {
        return prev || hasAllConditions;
      }
    }, requireForAll);

  return !!result;
}

export function selectorsIncludeConditionsForFIMOperationsUsingSlashStarStar(
  selectors: Selector[],
  selectorNames?: string[]
) {
  const result =
    selectorNames &&
    selectorNames.reduce((prev, cur) => {
      const selector = selectors.find((s) => s.name === cur);
      const usesFIM = selectorUsesFIM(selector);
      return prev || !!(usesFIM && selector?.targetFilePath?.includes('/**'));
    }, false);

  return !!result;
}

export function validateBlockRestrictions(selectors: Selector[], responses: Response[]) {
  const errors: string[] = [];

  responses.forEach((response) => {
    if (response.actions.includes('block')) {
      // check if any selectors are using FIM operations
      // and verify that targetFilePath is specfied in all 'match' selectors
      // or at least one 'exclude' selector
      const excludeUsesTargetFilePath = selectorsIncludeConditionsForFIMOperations(
        selectors,
        ['targetFilePath'],
        response.exclude
      );
      const matchSelectorsAllUsingTargetFilePath = selectorsIncludeConditionsForFIMOperations(
        selectors,
        ['targetFilePath'],
        response.match,
        true
      );

      if (!(matchSelectorsAllUsingTargetFilePath || excludeUsesTargetFilePath)) {
        errors.push(errorBlockActionRequiresTargetFilePath);
      }
    }
  });

  return errors;
}

export function validateMaxSelectorsAndResponses(selectors: Selector[], responses: Response[]) {
  const errors: string[] = [];
  const totalsByType = getTotalsByType(selectors, responses);

  // check selectors + responses doesn't exceed MAX_SELECTORS_AND_RESPONSES_PER_TYPE
  Object.values(totalsByType).forEach((count) => {
    if (count > MAX_SELECTORS_AND_RESPONSES_PER_TYPE) {
      errors.push(
        i18n.translate('xpack.cloudDefend.errorMaxSelectorsResponsesExceeded', {
          defaultMessage:
            'You cannot exceed {max} selectors + responses for a given type e.g file, process',
          values: { max: MAX_SELECTORS_AND_RESPONSES_PER_TYPE },
        })
      );
    }
  });

  return errors;
}

export function validateStringValuesForCondition(condition: SelectorCondition, values: string[]) {
  const errors: string[] = [];
  const maxValueBytes =
    SelectorConditionsMap[condition].maxValueBytes || MAX_CONDITION_VALUE_LENGTH_BYTES;

  const { pattern, patternError } = SelectorConditionsMap[condition];

  values.forEach((value) => {
    if (pattern && !new RegExp(pattern).test(value)) {
      if (patternError) {
        errors.push(patternError);
      } else {
        errors.push(
          i18n.translate('xpack.cloudDefend.errorGenericRegexFailure', {
            defaultMessage: '"{condition}" values must match the pattern: /{pattern}/',
            values: { condition, pattern },
          })
        );
      }
    }

    const bytes = new Blob([value]).size;
    if (bytes > maxValueBytes) {
      errors.push(
        i18n.translate('xpack.cloudDefend.errorMaxValueBytesExceeded', {
          defaultMessage: '"{condition}" values cannot exceed {maxValueBytes} bytes',
          values: { condition, maxValueBytes },
        })
      );
    }
  });

  return errors;
}

export function getRestrictedValuesForCondition(
  type: SelectorType,
  condition: SelectorCondition
): string[] | undefined {
  const options = SelectorConditionsMap[condition];

  if (Array.isArray(options.values)) {
    return options.values;
  }

  if (options?.values?.[type]) {
    return options.values[type];
  }
}

export function getSelectorConditions(type: SelectorType): SelectorCondition[] {
  const allConditions = Object.keys(SelectorConditionsMap) as SelectorCondition[];
  return allConditions.filter((key) => {
    const options = SelectorConditionsMap[key];
    return !options.selectorType || options.selectorType === type;
  });
}

export function getDefaultSelectorByType(type: SelectorType): Selector {
  switch (type) {
    case 'process':
      return JSON.parse(JSON.stringify(DefaultProcessSelector));
    case 'file':
    default:
      return JSON.parse(JSON.stringify(DefaultFileSelector));
  }
}

export function getDefaultResponseByType(type: SelectorType): Response {
  switch (type) {
    case 'process':
      return { ...DefaultProcessResponse };
    case 'file':
    default:
      return { ...DefaultFileResponse };
  }
}

export function getSelectorsAndResponsesFromYaml(configuration: string): {
  selectors: Selector[];
  responses: Response[];
} {
  let selectors: Selector[] = [];
  let responses: Response[] = [];

  try {
    const result = yaml.load(configuration);

    if (result) {
      // iterate selector/response types
      Object.keys(result).forEach((selectorType) => {
        const obj = result[selectorType];

        if (obj.selectors) {
          selectors = selectors.concat(
            obj.selectors.map((selector: any) => ({ ...selector, type: selectorType }))
          );
        }

        if (obj.responses) {
          responses = responses.concat(
            obj.responses.map((response: any) => ({ ...response, type: selectorType }))
          );
        }
      });
    }
  } catch {
    // noop
  }
  return { selectors, responses };
}

export function getYamlFromSelectorsAndResponses(selectors: Selector[], responses: Response[]) {
  const schema: any = {};

  selectors.reduce((current, selector: any) => {
    if (current && selector) {
      if (current[selector.type]) {
        current[selector.type]?.selectors.push(selector);
      } else {
        current[selector.type] = { selectors: [selector], responses: [] };
      }
    }

    // the 'any' cast is used so we can keep 'selector.type' type safe
    delete selector.type;

    return current;
  }, schema);

  responses.reduce((current, response: any) => {
    if (current && response) {
      if (current[response.type]) {
        current[response.type].responses.push(response);
      } else {
        current[response.type] = { selectors: [], responses: [response] };
      }
    }

    // the 'any' cast is used so we can keep 'response.type' type safe
    delete response.type;

    return current;
  }, schema);

  return yaml.dump(schema);
}
